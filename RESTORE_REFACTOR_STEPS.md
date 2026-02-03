# Restore refactored backend (get refactor back)

You're currently on the **reverted** state (pre-Blueprint). To get the **refactor back** without losing the option to return here, follow these steps in your PowerShell terminal (same folder as the project).

---

## Step 1: Backup current state (optional)

```powershell
cd "c:\Users\suppo\Desktop\youtube-clone - Copy (5)"
git branch backup-pre-refactor-restore-20260203
```

(This creates a branch pointing at your current commit so you can come back if needed.)

---

## Step 2: Restore the refactored commit

The refactored state you want is commit **3ab47d06a** — "Final Screenshot Email Update" (Fly Deploy #888). It has the Blueprint refactor and all the screenshot/email work.

```powershell
git reset --hard 3ab47d06a
```

Then confirm you're on that commit:

```powershell
git log -1 --oneline
```

You should see: `3ab47d06a Final Screenshot Email Update`

---

## Step 3: Push to GitHub so Fly deploys the refactor

Your remote `main` is still at the reverted commit. To make GitHub (and Fly) use the refactored code again, force push:

```powershell
git push --force origin main
```

- **GitHub** will show `main` at 3ab47d06a.
- **Fly Deploy** will run and deploy the refactored backend.

---

## Step 4: After deploy

- Backend will be back to the refactored app (Blueprints, routes, services).
- You can then fix **only** the screenshot-in-email path in this codebase (no need to sacrifice the refactor).

---

## If you need to go back to the reverted state

```powershell
git checkout backup-pre-refactor-restore-20260203
# or
git reset --hard c3e13fd40
```

---

## Summary

| Goal              | Command                    |
|-------------------|----------------------------|
| Backup current    | `git branch backup-pre-refactor-restore-20260203` |
| Restore refactor  | `git reset --hard 3ab47d06a` |
| Deploy refactor   | `git push --force origin main` |
