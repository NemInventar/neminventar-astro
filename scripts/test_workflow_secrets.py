# Secrets maa kun naas fra environment "production", som kun main maa bruge (16-11-2026).
# Et job, der laeser en secret uden `environment: production`, kraever den paa repo-niveau - og saa kan enhver
# med skriveadgang faa den udleveret fra en workflow paa sin egen branch.
# Undtaget: SUPABASE_URL og SUPABASE_ANON_KEY (staar i forvejen i det udgivne site) og GITHUB_TOKEN.
#   python3 scripts/test_workflow_secrets.py
import glob, os, re, sys

FRIE = {"SUPABASE_URL", "SUPABASE_ANON_KEY", "GITHUB_TOKEN"}
ROD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".github", "workflows")


def jobs(tekst):
    linjer = [l for l in tekst.splitlines() if not re.match(r"^\s*#", l)]
    try:
        start = next(i for i, l in enumerate(linjer) if re.match(r"^jobs:\s*$", l))
    except StopIteration:
        return []
    ud, nu = [], None
    for l in linjer[start + 1:]:
        m = re.match(r"^  ([A-Za-z0-9_-]+):\s*$", l)
        if m:
            nu = [m.group(1), ""]
            ud.append(nu)
        elif re.match(r"^\S", l):
            break
        elif nu:
            nu[1] += l + "\n"
    return ud


fejl = []
filer = sorted(glob.glob(os.path.join(ROD, "*.yml")) + glob.glob(os.path.join(ROD, "*.yaml")))
for f in filer:
    tekst = open(f, encoding="utf-8").read()
    if re.search(r"toJSON\(\s*secrets\s*\)", tekst):
        fejl.append("%s: toJSON(secrets) er ikke tilladt" % os.path.basename(f))
    for navn, krop in jobs(tekst):
        brugt = set(re.findall(r"secrets\.([A-Za-z0-9_]+)", krop)) - FRIE
        if brugt and not re.search(r"^    environment: production\s*$", krop, re.M):
            fejl.append("%s -> job %s bruger %s uden environment: production" % (os.path.basename(f), navn, ", ".join(sorted(brugt))))

if not filer:
    fejl.append("ingen workflows fundet")
for e in fejl:
    print("FEJL: " + e)
print("workflow-secrets: %d filer, %d fejl" % (len(filer), len(fejl)))
sys.exit(1 if fejl else 0)
