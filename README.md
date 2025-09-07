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

[Download Promptliano's Latest Prebuilt Bun Server and UI Bundle](https://github.com/brandon-schabel/promptliano/releases/download/v0.10.0/promptliano-0.10.0-bun-bundle.zip)

[Download Promptliano For MacOS arm64 Binary - M1 and Newer](https://github.com/brandon-schabel/promptliano/releases/download/v0.10.0/promptliano-0.10.0-macos-arm64.zip)

[Download Promptliano For Windows x64 Binary](https://github.com/brandon-schabel/promptliano/releases/download/v0.10.0/promptliano-0.10.0-windows-x64.zip)

[Download Promptliano For Linux x64 Binary](https://github.com/brandon-schabel/promptliano/releases/download/v0.10.0/promptliano-0.10.0-linux-x64.zip)

> Once you have downloaded Promptliano for your platform please read "Running Binaries", especially for MacOS

[View More Releases and Downloads](https://github.com/brandon-schabel/promptliano/releases)

Don't have Bun but have NPM? Install Bun using NPM: `npm install -g bun`

Don't have NPM or Bun? Install Bun with curl on Mac/Linux `curl -fsSL https://bun.sh/install | bash` on Windows Powershell: `powershell -c "irm bun.sh/install.ps1 | iex"`

Extract the zip file and cd into the extracted zip file and run the Promptliano server.

```bash
cd promptliano-0.10.0-bun-bundle && bun run start
```

### Access Promptliano

[View Your Local Promptliano UI](http://localhost:3579/)

## MCP Setup

Promptliano works with all MCP-compatible editors. The easiest way to set up MCP is through the Promptliano UI:

1. Create a project in Promptliano
2. Click the **MCP** button in the top-left corner
3. Follow the automated setup wizard for your editor

For manual setup instructions, see [docs/manual-mcp-setup.md](./docs/manual-mcp-setup.md).

![promptliano-0-5-0-project-overview](https://github.com/user-attachments/assets/f92680e4-2877-488a-b336-79533c3999d4)

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

Note: `bun run dev` auto-generates `.mcp-inspector.config.json` and starts the Inspector preconfigured to Promptliano (stdio). It runs headless and does not open a browser tab. To disable Inspector autostart:

```bash
MCP_INSPECTOR_AUTOSTART=false bun run dev
```

The server-only script (`bun run dev:server`) also starts the Inspector headlessly. You can run it manually anytime with `bun run mcp:inspector`.

Advanced: An HTTP endpoint may be available at `http://localhost:3147/api/mcp` (project‑scoped: `/api/projects/{id}/mcp`). STDIO is recommended for the Inspector.

## Running Binaries

### Running on Linux

On Linux you should be able to just navigate to the promptliano binary file in the terminal and run it for example:

```bash
cd ~/Downloads/promptliano-v0.10.0
```

Run the linux binary file:

```bash
./promptliano
```

### Running on MacOS

Currently I don't have MacOS code signing, so it just says the binary is damaged, but really it is quarntined. In order to run the binary on Mac you would have to do the following

```bash
cd ~/Downloads/promptliano-v0.10.0
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

After downloading and extracting the appropriate zip file (e.g., `promptliano-v0.10.0-windows-x64.zip`), open Command Prompt or PowerShell.

Navigate to the extracted folder. For example, if you extracted it to your Downloads folder:

```batch
cd %USERPROFILE%\Downloads\promptliano-v0.10.0-windows-x64
```

Or using PowerShell:

```powershell
cd $env:USERPROFILE\Downloads\promptliano-v0.10.0-windows-x64
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
