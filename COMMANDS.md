# Yorapet command reference

Server: `saravanakumar@homeserver` (192.168.0.160), project at `~/servers/yorapet3`.
API: https://yorapetapi.yoratech.com (port 8009).

## Update the server code

```bash
cd ~/servers/yorapet3 && git pull
```

## API (Docker, on the server)

Run these from `~/servers/yorapet3/docker`.

| Task | Command |
|---|---|
| Rebuild and start in the background | `docker compose up -d --build` |
| Restart | `docker compose restart api` |
| Stop | `docker compose down` |
| Status | `docker compose ps` |
| Follow logs | `docker compose logs -f api` |
| Health check | `curl https://yorapetapi.yoratech.com/health` |

## App users

```bash
# Create a user, or reset an existing user's password (prompts for the password)
docker compose exec api python create_user.py <username> "<Full Name>"
```

## Build the APK (on the server)

```bash
tmux new -s apk
cd ~/servers/yorapet3 && git pull
cd mobile && source ~/.android-env && npm ci
npx eas-cli@latest build -p android --profile preview --local
```

- Detach from tmux: `Ctrl+B` then `D`. Reattach: `tmux attach -t apk`.
- The `.apk` is written to `~/servers/yorapet3/mobile`.
- Copy it to the Mac (run on the Mac):

```bash
scp "saravanakumar@192.168.0.160:servers/yorapet3/mobile/*.apk" ~/Downloads/
```

Check the Expo login: `npx eas-cli@latest whoami`.

## Mobile development (on the Mac)

```bash
cd ~/Dev/yorapet3/mobile
npx expo start -c        # -c clears the cache; needed after changing .env files
```

- `.env` holds the production API URL and is committed; release builds use it.
- `.env.local` (not committed) overrides it for local development. Keep it off the server.

## Cloud build (alternative, no server needed)

```bash
cd ~/Dev/yorapet3/mobile
npx eas-cli@latest build -p android --profile preview --no-wait
```

Download the build from expo.dev → project → Builds.
