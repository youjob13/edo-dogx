# Auth Cat Animation Asset

Default animation source used by the component:

- `https://public.rive.app/community/runtime-files/2063-4080-flutter-puzzle-hack-project.riv`
- Rive community page: `https://rive.app/community/files/2063-4080-flutter-puzzle-hack-project/`

This asset is published under `CC BY 4.0` on the Rive community page, so attribution is required.

Place a licensed Rive file here as:

- `auth-cat.riv`

The component at [src/app/adapters/ui/auth-cat/auth-cat.component.ts](../../../../src/app/adapters/ui/auth-cat/auth-cat.component.ts) loads this file by default and maps these boolean state machine inputs when present:

- `hidden` or `passwordHidden`
- `isHandsUp`
- `focused`
- `isChecking`
- `typing`

And these number inputs when present:

- `look`
- `lookNum`

If the file is missing or fails to load, the component falls back to the built-in CSS cat.

For third-party assets (for example from Rive community/marketplace), keep attribution and license details in project docs as required by the asset license (for CC BY assets, attribution is mandatory).
