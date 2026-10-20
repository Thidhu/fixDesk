# FixDesk desktop app (Windows .exe + macOS .dmg)

The app opens your hosted FixDesk site and has the control helper built in:
no Node.js, no zip, no typing the code. Customer installs, clicks "Share my screen", reads out the code.

## Get the installers (GitHub builds them for you)
1. Deploy the server (Render etc.) and note its URL, e.g. https://yourapp.onrender.com
2. Push this whole project to a GitHub repo.
3. Repo > Settings > Secrets and variables > Actions > Variables > New variable:  SERVER_URL = your URL
   (or edit desktop/config.json instead)
4. Create a release build:  git tag v1.0.0 && git push --tags
   (or Actions tab > "Build installers" > Run workflow)
5. After ~10 minutes the .exe and .dmg appear under the repo's Releases page (tag builds) or the run's Artifacts.
   Send customers the Releases link.

## Try it locally
    cd desktop && npm install && npm start     (edit config.json to http://localhost:3000 first)

## Unsigned-app warnings
Windows: "unknown publisher" > More info > Run anyway.
Mac: right-click the app > Open (first time). Then allow FixDesk in Privacy & Security > Accessibility and Screen Recording.
The Mac build made by GitHub runs on Apple Silicon (M1 and newer).
