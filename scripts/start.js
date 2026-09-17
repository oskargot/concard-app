#!/usr/bin/env node
// Metro's default manifest URLs use whatever address the CLI thinks is "local"
// (127.0.0.1, or a LAN gateway IP), which only resolves for devices on the same
// network segment as this process. When this machine is joined to a Tailscale
// tailnet, its tailnet IP is reachable from any other device on that tailnet
// (e.g. a phone/tablet on Wi-Fi elsewhere) — so if `tailscale` is present and
// up, point Expo at that address instead via REACT_NATIVE_PACKAGER_HOSTNAME.
const { spawnSync } = require('child_process');

const env = { ...process.env };

if (!env.REACT_NATIVE_PACKAGER_HOSTNAME) {
	const tailscale = spawnSync('tailscale', ['ip', '-4'], { encoding: 'utf8', shell: true });
	const tailscaleIp = tailscale.status === 0 ? tailscale.stdout.trim().split('\n')[0] : null;
	if (tailscaleIp) {
		env.REACT_NATIVE_PACKAGER_HOSTNAME = tailscaleIp;
	}
}

const result = spawnSync('expo', ['start', ...process.argv.slice(2)], {
	stdio: 'inherit',
	env,
	shell: true
});

process.exit(result.status ?? 1);
