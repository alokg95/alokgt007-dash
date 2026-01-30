# Clawdbot Dashboard

Simple visual dashboard for Clawdbot gateway health, active sessions, and recent activity.

## Features

- **Password Protected**: Simple password prompt before accessing dashboard
- **Gateway Health**: Status, model config, auth providers
- **Active Sessions**: List of sessions with model, tokens, last activity
- **Activity Log**: Recent events with timestamp (CT timezone), filterable by 1h/4h/8h/24h
- Auto-refreshes every 1 minute

## Security Note

The dashboard is password-protected with a simple JavaScript check. The password is stored in the HTML source (visible if someone views the page source), so this is security by obscurity. It's suitable for personal dashboards where the URL isn't widely known, but not for high-security scenarios.

## Setup (GitHub Pages)

### 1. Create GitHub repo

```bash
cd /home/ubuntu/clawd/dashboard
git init
git add .
git commit -m "Initial dashboard"
```

### 2. Create a new repo on GitHub

Go to https://github.com/new and create a new repository (e.g., `clawdbot-dashboard`). Then:

```bash
git remote add origin git@github.com:YOUR_USERNAME/clawdbot-dashboard.git
git branch -M main
git push -u origin main
```

### 3. Enable GitHub Pages

1. Go to your repo → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: **main** → **/ (root)** → Save

The dashboard will be live at: `https://YOUR_USERNAME.github.io/clawdbot-dashboard/dashboard.html`

### 4. Set up auto-export cron

Add this to your crontab (`crontab -e`):

```bash
# Export dashboard data every 1 minute
* * * * * cd /home/ubuntu/clawd/dashboard && /usr/bin/node export-dashboard-data.js && git add data.json && git commit -m "Update dashboard data" && git push origin main >/dev/null 2>&1
```

**Note:** The first git push will ask for credentials. After that, it will run automatically.

To avoid git push prompts, set up SSH keys or use a GitHub Personal Access Token:

```bash
# Option 1: SSH (recommended)
# Follow: https://docs.github.com/en/authentication/connecting-to-github-with-ssh

# Option 2: Personal Access Token
git remote set-url origin https://YOUR_TOKEN@github.com/YOUR_USERNAME/clawdbot-dashboard.git
```

### 5. Access the dashboard

Visit: `https://YOUR_USERNAME.github.io/clawdbot-dashboard/dashboard.html`

## Manual refresh

You can manually run the export script anytime:

```bash
cd /home/ubuntu/clawd/dashboard
node export-dashboard-data.js
```

Then commit and push:

```bash
git add data.json
git commit -m "Manual update"
git push
```

## Troubleshooting

**Dashboard shows "Loading..." forever**
- Check that `data.json` exists and is valid JSON
- Check browser console for CORS errors (shouldn't happen with GitHub Pages)

**Activity log is empty**
- Check that session files exist: `ls ~/.clawdbot/agents/main/sessions/*.jsonl`
- Run export script manually to see if there are errors

**Sessions showing "unknown"**
- Session parsing works best with recent sessions (last 24h)
- Older sessions may not have all metadata
