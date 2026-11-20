# Min side, fase 0a: delt postkasse konto@ og Graph-appen "NI Konto", der KUN må sende fra den.
# Samme mønster som C:\dev\ni-underskriv\ops\fase0a-entra-app.ps1 + fase0a-exchange.ps1, samlet i ét script.
#
# Kør (PowerShell 7):  pwsh -File C:\dev\neminventar-astro-minside\konto\ops\fase0a-konto-mail.ps1
# Der logges ind to gange som js@neminventar.dk: først med en kode (Entra), så i et browservindue (Exchange).
#
# Scriptet ændrer kun:
#   Entra:    app-registreringen "NI Konto" + dens enterprise application, UDEN API-rettigheder
#             (Entra- og Exchange-rettigheder lægges sammen, så Mail.Send i Entra ville ophæve afgrænsningen).
#   Exchange: postkassen konto@ (hvis den mangler), en service principal, et scope og én rolletildeling.
# Det opretter ingen nøgle og intet certifikat. Det er næste trin.
# Kan køres igen: alt, der findes i forvejen, springes over.

param(
    [string]$AppName = "NI Konto",
    [string]$Mailbox = "konto@neminventar.dk",
    [string]$MailboxName = "Nem Inventar",   # afsendernavnet kunden ser på koden
    [switch]$DeviceCode                       # Exchange-login med kode fra en anden enhed i stedet for browservindue
)

$ErrorActionPreference = "Stop"

# ---------- 1. Entra: app-registrering uden rettigheder ----------
$clientId = "14d82eec-204b-4c2f-b7e8-296a70dab67e"  # Microsofts egen offentlige klient "Microsoft Graph Command Line Tools"
$authority = "https://login.microsoftonline.com/organizations/oauth2/v2.0"

$device = Invoke-RestMethod -Method Post -Uri "$authority/devicecode" -Body @{ client_id = $clientId; scope = "https://graph.microsoft.com/Application.ReadWrite.All" }
Write-Host $device.message -ForegroundColor Yellow

$deadline = (Get-Date).AddSeconds([int]$device.expires_in)
$token = $null
while (-not $token -and (Get-Date) -lt $deadline) {
    Start-Sleep -Seconds ([int]$device.interval)
    try {
        $token = (Invoke-RestMethod -Method Post -Uri "$authority/token" -Body @{
                grant_type  = "urn:ietf:params:oauth:grant-type:device_code"
                client_id   = $clientId
                device_code = $device.device_code
            }).access_token
    } catch {
        $code = $null
        try { $code = ($_.ErrorDetails.Message | ConvertFrom-Json).error } catch { }
        if ($code -notin @("authorization_pending", "slow_down")) { throw }
    }
}
if (-not $token) { throw "Login udløb, før koden blev brugt. Kør scriptet igen." }

$headers = @{ Authorization = "Bearer $token" }
$graph = "https://graph.microsoft.com/v1.0"

# Rigtig konto? Kontonavnet står i selve login-beviset (JWT), så det kræver ingen ekstra rettighed at læse.
$part = $token.Split(".")[1].Replace("-", "+").Replace("_", "/")
$part += "=" * ((4 - $part.Length % 4) % 4)
$claims = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($part)) | ConvertFrom-Json
$entraUpn = "$($claims.upn)"
Write-Host "Logget ind i Entra som: $entraUpn"
if ($entraUpn -notlike "*@neminventar.dk") { throw "Logget ind som '$entraUpn', ikke en @neminventar.dk-konto. Intet er ændret. Kør igen og vælg js@neminventar.dk." }

$filter = [uri]::EscapeDataString("displayName eq '$AppName'")
$app = (Invoke-RestMethod -Headers $headers -Uri "$graph/applications?`$filter=$filter&`$select=id,appId,displayName,requiredResourceAccess").value | Select-Object -First 1
if ($app) {
    Write-Host "App-registreringen findes allerede: $($app.appId)"
} else {
    $app = Invoke-RestMethod -Method Post -Headers $headers -ContentType "application/json" -Uri "$graph/applications" -Body (@{ displayName = $AppName; signInAudience = "AzureADMyOrg" } | ConvertTo-Json)
    Write-Host "OK oprettet app-registrering $AppName"
}
if (@($app.requiredResourceAccess).Count -gt 0) { throw "Appen $AppName har API-rettigheder i Entra. Fjern dem først, ellers gælder afgrænsningen til $Mailbox ikke." }

$spFilter = [uri]::EscapeDataString("appId eq '$($app.appId)'")
$sp = (Invoke-RestMethod -Headers $headers -Uri "$graph/servicePrincipals?`$filter=$spFilter&`$select=id,appId").value | Select-Object -First 1
if (-not $sp) {
    $sp = Invoke-RestMethod -Method Post -Headers $headers -ContentType "application/json" -Uri "$graph/servicePrincipals" -Body (@{ appId = $app.appId } | ConvertTo-Json)
    Write-Host "OK oprettet enterprise application"
}
$AppId = $app.appId
$ObjectId = $sp.id

# ---------- 2. Exchange: postkasse + ret til at sende, kun fra den ----------
if (-not (Get-Module -ListAvailable -Name ExchangeOnlineManagement)) {
    Write-Host "Installerer ExchangeOnlineManagement-modulet for den aktuelle bruger ..."
    Install-Module ExchangeOnlineManagement -Scope CurrentUser -Force
}
Import-Module ExchangeOnlineManagement
if ($DeviceCode) { Connect-ExchangeOnline -Device -ShowBanner:$false } else { Connect-ExchangeOnline -ShowBanner:$false }

$upn = "$((Get-ConnectionInformation | Select-Object -First 1).UserPrincipalName)"
Write-Host "Logget ind i Exchange som: $upn"
if ($upn -notlike "*@neminventar.dk") {
    Disconnect-ExchangeOnline -Confirm:$false
    throw "Logget ind som '$upn', ikke en @neminventar.dk-konto. Exchange er ikke ændret. Kør igen og vælg js@neminventar.dk."
}

$needed = "New-Mailbox", "New-ServicePrincipal", "New-ManagementScope", "New-ManagementRoleAssignment", "Test-ServicePrincipalAuthorization"
$missing = $needed | Where-Object { -not (Get-Command $_ -ErrorAction SilentlyContinue) }
if ($missing) { throw "Kontoen mangler kommandoerne: $($missing -join ', '). Log ind med en Exchange- eller Global Admin-konto." }

# Exchange-kommandoer stopper ikke altid scriptet ved fejl: -ErrorAction Stop på hver ændring og et opslag bagefter.
if (-not (Get-Mailbox -Identity $Mailbox -ErrorAction SilentlyContinue)) {
    New-Mailbox -Shared -Name "NI Konto" -DisplayName $MailboxName -PrimarySmtpAddress $Mailbox -ErrorAction Stop | Out-Null
}
if (-not (Get-Mailbox -Identity $Mailbox -ErrorAction SilentlyContinue)) { throw "Postkassen $Mailbox findes ikke efter oprettelse" }
Write-Host "OK postkasse $Mailbox"

# En ny enterprise application kan være et par minutter om at nå Exchange.
$until = (Get-Date).AddMinutes(10)
while (-not (Get-ServicePrincipal -Identity $AppId -ErrorAction SilentlyContinue)) {
    try { New-ServicePrincipal -AppId $AppId -ObjectId $ObjectId -DisplayName $AppName -ErrorAction Stop | Out-Null }
    catch {
        if ((Get-Date) -gt $until) { throw }
        Write-Host "  venter på at appen når Exchange ..."
        Start-Sleep -Seconds 30
    }
}
Write-Host "OK service principal $AppName"

$scopeName = "NI Konto postkasse"
if (-not (Get-ManagementScope -Identity $scopeName -ErrorAction SilentlyContinue)) {
    New-ManagementScope -Name $scopeName -RecipientRestrictionFilter "PrimarySmtpAddress -eq '$Mailbox'" -ErrorAction Stop | Out-Null
}
if (-not (Get-ManagementScope -Identity $scopeName -ErrorAction SilentlyContinue)) { throw "Scope '$scopeName' findes ikke efter oprettelse" }
Write-Host "OK scope '$scopeName'"

$assignmentName = "NI Konto Mail.Send"
if (-not (Get-ManagementRoleAssignment -Identity $assignmentName -ErrorAction SilentlyContinue)) {
    New-ManagementRoleAssignment -Name $assignmentName -App $AppId -Role "Application Mail.Send" -CustomResourceScope $scopeName -ErrorAction Stop | Out-Null
}
if (-not (Get-ManagementRoleAssignment -Identity $assignmentName -ErrorAction SilentlyContinue)) { throw "Rolletildelingen '$assignmentName' findes ikke" }
Write-Host "OK 'Application Mail.Send' begrænset til $Mailbox"

Write-Host ""
Write-Host "Test mod $Mailbox (forventet: InScope = True):"
Test-ServicePrincipalAuthorization -Identity $AppId -Resource $Mailbox | Format-Table RoleName, InScope
Write-Host "Test mod js@neminventar.dk (forventet: InScope = False):"
Test-ServicePrincipalAuthorization -Identity $AppId -Resource "js@neminventar.dk" | Format-Table RoleName, InScope

Disconnect-ExchangeOnline -Confirm:$false

Write-Host ""
Write-Host "Rettigheder kan være 30 min til 2 timer om at slå igennem."
Write-Host "RESULTAT AppId=$AppId ObjectId=$ObjectId" -ForegroundColor Green
