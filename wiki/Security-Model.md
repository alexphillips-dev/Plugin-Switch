# Security Model

[Home](Home) · [Architecture](Architecture) · [Safety & Recovery](Safety-and-Recovery)

Plugin Switch integrates with a **privileged Unraid WebGUI**. A plugin that can launch shell adapters, move boot manifests and alter installed-plugin registration must be treated as administrative software, not as an unprivileged dashboard widget.

## Trust boundaries

1. **Unraid WebGUI authentication/CSRF:** Plugin Switch's API is intended to be served only through Unraid's authenticated WebGUI. Unraid's request middleware validates CSRF tokens on state-changing POST requests. The middleware removes the validated token before the Plugin Switch PHP handler runs; Plugin Switch must not validate that field a second time.
2. **Read-only discovery:** Raw `.plg` manifests, including embedded scripts, are **untrusted input**. The scanner reads and limits their content but does not execute discovered commands. Candidate services are not approved live controls.
3. **Trusted adapter boundary:** A local adapter is a privileged shell program an administrator has chosen to trust. Bundled profiles additionally require an exact manifest digest and adapter digest. Runtime `status` checks must pass before enabling controls.
4. **Persistent state:** Disabled manifests, policy files and journals live on the boot flash. Their integrity matters across reboots. Do not make these directories writable to untrusted accounts or containers.
5. **Browser/UI:** The lock/details modal uses isolated Shadow DOM styling; detected plugin strings are escaped before insertion into generated HTML. External manifests must never be treated as executable browser scripts.

## State-changing operations

Normal state changes use POST and the Unraid CSRF check. The controller validates plugin identifiers, rejects protected components, checks for expected files/symlinks, uses an exclusive operation lock, and records transaction phases. It does not construct a shell command by concatenating arbitrary browser-supplied paths.

The controller's verification reduces risk, but **cannot make an unsafe adapter safe**. A malicious or poorly written root-level adapter can compromise the host. Treat local adapter installation as an administrator-level change requiring source review and recovery planning.

## Network access

- **Scan compatibility:** local file inspection; no remote scan service and no telemetry upload.
- **Export report:** local browser download; review before sharing publicly.
- **Check updates:** a user-triggered HTTPS request to the manifest URL, restricted to this repository's `dev` or `main` raw GitHub endpoint. Timeouts are bounded, redirects are not followed, and results are cached briefly.
- **Plugin installation/update:** Unraid's native installer may fetch URLs referenced by installed plugin definitions. That is a separate operation and may execute third-party installation scripts.

## Defense in depth and limitations

- Exact-match profile digests help detect changed manifests, but do not replace human code review.
- Local adapter ownership/mode checks reduce accidental misuse, but root-owned scripts are still powerful.
- Transaction journals and rollback are **best effort**, not complete system snapshots.
- Explicit dependency protection does not discover every relationship or prevent other software from changing state.
- A temporary incompatibility or failed status probe should fail **closed**, not automatically unlock a switch.
- The `dev` channel is a development build. Review the diff and keep backups before deploying changes on production systems.

## Reporting security issues

Do not publish tokens, private hostnames or credentials in GitHub issues. Use the repository's available security reporting settings, or contact the maintainer privately if a sensitive disclosure channel is available. For ordinary non-sensitive bugs use [Issues](https://github.com/alexphillips-dev/Plugin-Switch/issues).
