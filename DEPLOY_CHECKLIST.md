# Deploy Checklist

When you deploy manually, the live app can revert to an old broken version.

## Frontend
- Run: cd frontend then npm run build
- Deploy the NEW frontend/dist/ from this repo, not an old backup
- If Netlify builds from Git, push latest commits first

## Backend  
- Run: cd backend then fly deploy
- Use the backend/ folder that has your current app.py

## If the error returns
The live site is likely serving an old frontend build. Run npm run build in frontend/ again and redeploy the new dist/.
