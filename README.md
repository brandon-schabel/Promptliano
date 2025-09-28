# Promptliano

[![Website Deployment](https://github.com/brandon-schabel/promptliano/actions/workflows/deploy-website.yml/badge.svg)](https://github.com/brandon-schabel/promptliano/actions/workflows/deploy-website.yml)
[![GitHub Pages](https://img.shields.io/badge/Website-promptliano.com-blue)](https://promptliano.com)

## What is Promptliano?

Promptliano is an MCP (Model Context Protocol) server that gives AI assistants deep understanding of your codebase. It provides intelligent context management, reducing token usage by 60-70% while improving code generation accuracy. Works seamlessly with Claude Desktop, Cursor, VSCode, and other MCP-compatible editors.

Learn more at [promptliano.com](https://promptliano.com)

## Quick Start

### Option 1: CLI Setup (Recommended)

The easiest way to get started with Promptliano is using our CLI tool:

```bash
npx promptliano@latest
```

This will:

- Download and install the Promptliano server
- Configure MCP for your AI editor (Claude, Cursor, etc.)
- Start the server automatically
- Guide you through creating your first project

> **Note:** Using `@latest` ensures you always run the most recent version. No installation required!

### Option 2: Manual Download

If you prefer to download and run Promptliano manually:

[Download Promptliano's Latest Prebuilt Bun Server and UI Bundle](https://github.com/brandon-schabel/promptliano/releases/download/v0.11.0/promptliano-0.11.0-bun-bundle.zip)

[Download Promptliano For MacOS arm64 Binary - M1 and Newer](https://github.com/brandon-schabel/promptliano/releases/download/v0.11.0/promptliano-0.11.0-macos-arm64.zip)

[Download Promptliano For Windows x64 Binary](https://github.com/brandon-schabel/promptliano/releases/download/v0.11.0/promptliano-0.11.0-windows-x64.zip)

[Download Promptliano For Linux x64 Binary](https://github.com/brandon-schabel/promptliano/releases/download/v0.11.0/promptliano-0.11.0-linux-x64.zip)

> Once you have downloaded Promptliano for your platform please read "Running Binaries", especially for MacOS

[View More Releases and Downloads](https://github.com/brandon-schabel/promptliano/releases)

Don't have Bun but have NPM? Install Bun using NPM: `npm install -g bun`

Don't have NPM or Bun? Install Bun with curl on Mac/Linux `curl -fsSL https://bun.sh/install | bash` on Windows Powershell: `powershell -c "irm bun.sh/install.ps1 | iex"`

Extract the zip file and cd into the extracted zip file and run the Promptliano server.

```bash
cd promptliano-0.11.0-bun-bundle && bun run start
```

### Access Promptliano

[View Your Local Promptliano UI](http://localhost:3579/)

## Database Location & Overrides

- Development default: `./data/promptliano.db` at the repo root (auto-created).
- Production default (prebuilt binaries):
  - macOS: `~/Library/Application Support/Promptliano/promptliano.db`
  - Linux: `$XDG_DATA_HOME/promptliano/promptliano.db` or `~/.local/share/promptliano/promptliano.db`
  - Windows: `%APPDATA%\\Promptliano\\promptliano.db`

Override options (take precedence in this order):

- `DATABASE_PATH` — absolute path to the SQLite file
- `PROMPTLIANO_DATA_DIR` — directory to store `promptliano.db`

Examples:

- macOS/Linux: `DATABASE_PATH="$HOME/.promptliano/custom.db" ./promptliano`
- macOS/Linux: `PROMPTLIANO_DATA_DIR="$HOME/.promptliano" ./promptliano`
- Windows (PowerShell): `$env:DATABASE_PATH = "$env:USERPROFILE\\Promptliano\\my.db"; .\\promptliano.exe`
- Docker: mount a volume and set `PROMPTLIANO_DATA_DIR=/data`

Notes:

- Tests use `:memory:` automatically.
- The app creates the DB directory if needed. If the location is read-only, you’ll see an EROFS error — use one of the overrides above.

## MCP Setup

Promptliano works with all MCP-compatible editors. The easiest way to set up MCP is through the Promptliano UI:

1. Create a project in Promptliano
2. Click the **MCP** button in the top-left corner
3. Follow the automated setup wizard for your editor

For manual setup instructions, see [docs/manual-mcp-setup.md](./docs/manual-mcp-setup.md).

![promptliano-0-5-0-project-overview](https://github.com/user-attachments/assets/f92680e4-2877-488a-b336-79533c3999d4)

### MCP Testing & Debugging

- Use the bundled smoke tests to confirm MCP behaviour:
- `bun test-mcp-resources.js` — exercises the base MCP server (`createMCPServer`) via an in-memory client transport.
  - `bun test-mcp-stdio-resources.js` — validates the richer stdio server surface used by the CLI/Inspector.
- The MCP SDK requires an active transport before calling `server.request(...)`. Use the provided in-memory harness (`packages/server/src/mcp/test-utils/inmemory-client.ts`) in scripts and tests instead of invoking request handlers directly on an unconnected server.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/brandon-schabel/promptliano
cd promptliano

# Install dependencies (requires Bun)
bun install

# Start development server
bun run dev
```

The development UI will be available at [http://localhost:1420](http://localhost:1420)

### File Search Backend

Promptliano uses a fast, no-index search stack with structural AST support by default.

- Backends (auto-selected):
  - `sg` (default): ast-grep performs structural AST search across your codebase
  - `rg`: ripgrep text search as a robust fallback
  - `fts`: minimal SQLite FTS5 fallback (if table exists)
  - `like`: SQL LIKE fallback when others are unavailable
- Configure via env:
  - `FILE_SEARCH_BACKEND=sg|rg|fts|like` (default `sg`)
  - `FILE_SEARCH_ASTGREP_PATH=/path/to/ast-grep` (optional)
  - `FILE_SEARCH_RIPGREP_PATH=/path/to/rg` (optional)

Install ast-grep if you don't already have it:

```
npm install --global @ast-grep/cli  # or: brew install ast-grep
```

Optional: install additional grep utilities

These tools are auto‑detected. If they aren’t on your PATH, either install them or set `FILE_SEARCH_ASTGREP_PATH` / `FILE_SEARCH_RIPGREP_PATH`.

- ast-grep (sg): structural search
  - macOS (Homebrew): `brew install ast-grep`
  - Node (npm): `npm install --global @ast-grep/cli`
  - Rust (cargo): `cargo install ast-grep --locked`
  - Windows (Scoop): `scoop install main/ast-grep`
  - macOS (MacPorts): `sudo port install ast-grep`
  - Python (pip): `pip install ast-grep-cli`
  - Nix: `nix-shell -p ast-grep`

- ripgrep (rg): fast text search fallback
  - macOS (Homebrew): `brew install ripgrep`
  - Debian/Ubuntu: `sudo apt-get install ripgrep`
  - Fedora: `sudo dnf install ripgrep`
  - Arch: `sudo pacman -S ripgrep`
  - Windows (Chocolatey): `choco install ripgrep`
  - Windows (winget): `winget install ripgrep`
  - Windows (Scoop): `scoop install ripgrep`

Upgrading from older versions: run database migrations (below) to drop legacy search tables.

### Port Configuration (Dev)

- Server API: `SERVER_PORT` or `PORT` (default: 3147)
- Client UI (Vite): `CLIENT_DEV_PORT` (default: 1420)
- Drizzle Studio: `DRIZZLE_STUDIO_PORT` (default: 4983)
- MCP Inspector UI: `MCP_INSPECTOR_CLIENT_PORT` (default: 6274)
- MCP Inspector Proxy: `MCP_INSPECTOR_SERVER_PORT` (default: 6277)
  - Alternatively, set Inspector's native vars: `CLIENT_PORT` / `SERVER_PORT`.
    The dev script maps `MCP_INSPECTOR_*` to these for the Inspector process.
- Dev tool autostart flags (default: disabled)
  - `DEVTOOLS_ENABLE_DRIZZLE_STUDIO` — launch Drizzle Studio when running `bun run dev`
  - `DEVTOOLS_ENABLE_MCP_INSPECTOR` — launch the MCP Inspector UI + proxy during `bun run dev` or `bun run dev:server`

Example:

```bash
SERVER_PORT=4000 CLIENT_DEV_PORT=3001 DRIZZLE_STUDIO_PORT=4999 \
MCP_INSPECTOR_CLIENT_PORT=8080 MCP_INSPECTOR_SERVER_PORT=9000 \
bun run dev
```

Note: The dev script auto‑frees these ports before starting.

### Database Migrations

Run Drizzle migrations whenever you pull changes or upgrade:

```
bun run db:migrate
```

This includes a migration to drop legacy file search tables (`file_search_metadata`, `file_keywords`, `file_trigrams`, `search_cache`, and `file_search_fts`) as the new ripgrep/FTS-min backends do not require pre-indexing.

### MCP Inspector Config (Promptliano)

Recommended: use STDIO transport (matches our MCP services).

Option A — macOS/Linux (uses helper script):

- Transport: `stdio`
- Command: `sh`
- Args: `["packages/server/mcp-start.sh"]`

Option B — Windows:

- Transport: `stdio`
- Command: `cmd.exe`
- Args: `["/c", "packages\\server\\mcp-start.bat"]`

Option C — Cross‑platform (no shell scripts):

- Transport: `stdio`
- Command: `bun`
- Args: `["run", "-C", "packages/server", "mcp"]`

Optional env:

- `PROMPTLIANO_PROJECT_ID`: scope tools/resources to a specific project ID

Example `mcp.json` (macOS/Linux script):

```json
{
  "mcpServers": {
    "promptliano": {
      "type": "stdio",
      "command": "sh",
      "args": ["packages/server/mcp-start.sh"],
      "env": {
        "PROMPTLIANO_PROJECT_ID": "1"
      }
    }
  }
}
```

Note: `bun run dev` auto-generates `.mcp-inspector.config.json` and can start the Inspector preconfigured to Promptliano (stdio).
Set `DEVTOOLS_ENABLE_MCP_INSPECTOR=true` in `.env` to launch it headlessly (no browser tab) alongside the dev server. The same
flag controls `bun run dev:server`. Leave it `false` to skip starting the Inspector automatically; you can still run
`bun run mcp:inspector` manually at any time. Similarly, `DEVTOOLS_ENABLE_DRIZZLE_STUDIO=true` launches Drizzle Studio when you
run `bun run dev`.

Advanced: An HTTP endpoint may be available at `http://localhost:3147/api/mcp` (project‑scoped: `/api/projects/{id}/mcp`). STDIO is recommended for the Inspector.

## GitHub Copilot (via proxy)

Promptliano supports GitHub Copilot through an OpenAI‑compatible proxy (e.g., ericc‑ch/copilot‑api). You can point Promptliano directly at the upstream or use the built‑in reverse proxy exposed at `/api/proxy/copilot/v1`.

- Start the upstream proxy:
  - `npx copilot-api@latest start --port 4141 --rate-limit 30`
  - or Docker (see the copilot-api README)
- Configure environment (see `.env.example`):
  - Option A (direct):
    - `COPILOT_BASE_URL=http://127.0.0.1:4141/v1`
    - `COPILOT_API_KEY=dummy` (proxy typically accepts any bearer string)
  - Option B (built‑in reverse proxy):
    - `COPILOT_PROXY_UPSTREAM=http://127.0.0.1:4141/v1`
    - `COPILOT_BASE_URL=http://127.0.0.1:${SERVER_PORT}/api/proxy/copilot/v1`
    - `COPILOT_API_KEY=dummy`
- In the UI Providers page, add a provider key for `GitHub Copilot` (use the same dummy key if you prefer DB storage over env vars).

Notes

- Rate‑limit the upstream proxy to avoid GitHub abuse detection (`--rate-limit 30` recommended) and prefer manual approval for sensitive ops if supported by the proxy (`--manual`).
- The upstream exposes OpenAI‑compatible endpoints (`/v1/models`, `/v1/chat/completions`) so you can select Copilot and its models like any other provider.

See docs/copilot-integration.md for a full guide and architecture details.

## Running Binaries

### Running on Linux

On Linux you should be able to just navigate to the promptliano binary file in the terminal and run it for example:

```bash
cd ~/Downloads/promptliano-v0.11.0
```

Run the linux binary file:

```bash
./promptliano
```

### Running on MacOS

Currently I don't have MacOS code signing, so it just says the binary is damaged, but really it is quarntined. In order to run the binary on Mac you would have to do the following

```bash
cd ~/Downloads/promptliano-v0.11.0
```

Then run to remove the quarantine:

```bash
sudo xattr -r -d com.apple.quarantine ./promptliano
```

Finally you can run the Promptliano app by running the binary file as you normally would

```bash
./promptliano
```

### Running on Windows

After downloading and extracting the appropriate zip file (e.g., `promptliano-v0.11.0-windows-x64.zip`), open Command Prompt or PowerShell.

Navigate to the extracted folder. For example, if you extracted it to your Downloads folder:

```batch
cd %USERPROFILE%\Downloads\promptliano-v0.11.0-windows-x64
```

Or using PowerShell:

```powershell
cd $env:USERPROFILE\Downloads\promptliano-v0.11.0-windows-x64
```

Then, run the executable:

```batch
.\promptliano.exe
```

## Documentation

- [Getting Started Guide](https://promptliano.com/docs/getting-started)
- [MCP Integration](https://promptliano.com/integrations)
- [API Reference](https://promptliano.com/docs/api)
- [View all docs](https://promptliano.com/docs)
- Local guides: `docs/` for usage/setup notes, `dev-docs/` for deep-dive engineering docs

### API Documentation

- Server Base: [http://localhost:3147](http://localhost:3147)
- Swagger UI: [http://localhost:3147/swagger](http://localhost:3147/swagger)
- OpenAPI Spec: [http://localhost:3147/doc](http://localhost:3147/doc)

## Tech Stack

**Backend:** Bun, Hono, Zod, AI SDK  
**Frontend:** React, Vite, TanStack Router/Query, shadcn/ui, Tailwind CSS  
**Documentation:** OpenAPI/Swagger

## Building from Source

To create platform-specific binaries:

```bash
bun run build-binaries
```

This creates standalone executables for Linux, macOS, and Windows in the `/dist` directory.

## Contributing

We welcome all contributions—whether you're fixing a bug, adding a feature, or improving docs.  
General guidelines:

1. **Fork & Clone**
2. **Create** a new feature branch
3. **Implement** & Test
4. **Open** a Pull Request

Let's make Promptliano even better together!

---

## License

Promptliano is **open-source** under the [MIT License](./LICENSE). See [LICENSE](./LICENSE) for more details.

---

## Support

Join our **[Discord community](https://discord.gg/Z2nDnVQKKm)** for support, feature requests, and discussions.
