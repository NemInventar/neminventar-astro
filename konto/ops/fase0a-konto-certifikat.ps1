# Min side, fase 0a: certifikat til Graph-appen "NI Konto", så test-Workeren kan sende koder fra konto@.
#
# Kør (PowerShell 7):  pwsh -File C:\dev\neminventar-astro-minside\konto\ops\fase0a-konto-certifikat.ps1
#
# Scriptet:
#   1. laver et nyt nøglepar i hukommelsen (RSA 3072, gyldigt i 2 år). Intet skrives til disk eller certifikatlageret.
#   2. lægger den OFFENTLIGE del på appen i Entra (login med kode som js@).
#   3. lægger certifikatet og den PRIVATE nøgle i GitHub som secrets i environment production
#      (KONTO_STAGING_GRAPH_CERT_PEM, KONTO_STAGING_GRAPH_KEY_PEM). Den private nøgle vises aldrig på skærmen.
# Appens eksisterende certifikater bevares. Køres scriptet igen, får appen et nyt ved siden af det gamle.

param(
    [string]$AppId = "2e026f28-e4bf-4b4f-829a-8f569720c16b",
    [string]$Repo = "NemInventar/neminventar-astro",
    [string]$Environment = "production",
    [string]$Prefix = "KONTO_STAGING"
)

$ErrorActionPreference = "Stop"
if ($PSVersionTable.PSVersion.Major -lt 7) { throw "Kør med pwsh (PowerShell 7), ikke powershell.exe." }
gh auth status -h github.com *> $null
if ($LASTEXITCODE -ne 0) { throw "gh er ikke logget ind. Intet er ændret." }

# ---------- Login i Entra ----------
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

$part = $token.Split(".")[1].Replace("-", "+").Replace("_", "/")
$part += "=" * ((4 - $part.Length % 4) % 4)
$upn = "$(([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($part)) | ConvertFrom-Json).upn)"
Write-Host "Logget ind i Entra som: $upn"
if ($upn -notlike "*@neminventar.dk") { throw "Logget ind som '$upn', ikke en @neminventar.dk-konto. Intet er ændret." }

$headers = @{ Authorization = "Bearer $token" }
$graph = "https://graph.microsoft.com/v1.0"
$app = Invoke-RestMethod -Headers $headers -Uri "$graph/applications(appId='$AppId')?`$select=id,displayName,keyCredentials"
Write-Host "App: $($app.displayName) · certifikater i forvejen: $(@($app.keyCredentials).Count)"

# ---------- Nøglepar i hukommelsen ----------
$rsa = [System.Security.Cryptography.RSA]::Create(3072)
$req = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
    "CN=NI Konto", $rsa,
    [System.Security.Cryptography.HashAlgorithmName]::SHA256,
    [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
$from = [DateTimeOffset]::UtcNow.AddMinutes(-5)
$to = $from.AddYears(2)
$cert = $req.CreateSelfSigned($from, $to)
$certPem = $cert.ExportCertificatePem()
$keyPem = $rsa.ExportPkcs8PrivateKeyPem()

# ---------- Offentlig del på appen (de eksisterende bevares) ----------
$existing = @($app.keyCredentials | ForEach-Object {
        @{ customKeyIdentifier = $_.customKeyIdentifier; displayName = $_.displayName; endDateTime = $_.endDateTime
           keyId = $_.keyId; startDateTime = $_.startDateTime; type = $_.type; usage = $_.usage }
    })
$new = @{
    type          = "AsymmetricX509Cert"
    usage         = "Verify"
    key           = [Convert]::ToBase64String($cert.RawData)
    displayName   = "NI Konto test-Worker $(Get-Date -Format 'yyyy-MM-dd')"
    # Ingen start/slut her: Entra læser dem ud af certifikatet. En slutdato efter certifikatets egen afvises
    # (certifikatet runder ned til hele sekunder).
}
$body = @{ keyCredentials = @($existing + $new) } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Patch -Headers $headers -ContentType "application/json" -Uri "$graph/applications/$($app.id)" -Body $body | Out-Null
Write-Host "OK certifikatet ligger på appen (fingeraftryk $($cert.Thumbprint), udløber $($to.ToString('dd-MM-yyyy')))"

# ---------- Secrets i GitHub ----------
$certPem | gh secret set "${Prefix}_GRAPH_CERT_PEM" -R $Repo --env $Environment
if ($LASTEXITCODE -ne 0) { throw "Kunne ikke sætte ${Prefix}_GRAPH_CERT_PEM" }
$keyPem | gh secret set "${Prefix}_GRAPH_KEY_PEM" -R $Repo --env $Environment
if ($LASTEXITCODE -ne 0) { throw "Kunne ikke sætte ${Prefix}_GRAPH_KEY_PEM" }

$keyPem = $null
$rsa.Dispose()
$cert.Dispose()
Write-Host ""
Write-Host "RESULTAT certifikat på appen + 2 secrets i GitHub ($Environment)" -ForegroundColor Green
