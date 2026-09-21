#!/usr/bin/env node
// Metro's default manifest URLs use whatever address the CLI thinks is "local".
// Expo picks the *first* non-internal IPv4 that Node enumerates, which on a
// machine with a VPN or a VM adapter is routinely the wrong one — a ProtonVPN
// or VirtualBox address no phone can reach. When this machine is joined to a
// Tailscale tailnet, its tailnet IP is reachable from any other device on that
// tailnet (e.g. a phone/tablet on Wi-Fi elsewhere), so prefer that and hand it
// to Expo via REACT_NATIVE_PACKAGER_HOSTNAME.
//
// `tailscale` is frequently *not* on PATH even while the tailnet is up — the
// Windows installer doesn't add it — so check the usual install locations too.
// And if no tailnet address turns up, say so: silently falling through to
// Expo's guess is exactly what produces a QR code that never connects.
const { spawnSync } = require('child_process');
const fs = require('fs');

const INSTALL_PATHS = {
	win32: ['C:\\Program Files\\Tailscale\\tailscale.exe'],
	darwin: [
		'/Applications/Tailscale.app/Contents/MacOS/Tailscale',
		'/opt/homebrew/bin/tailscale',
		'/usr/local/bin/tailscale'
	],
	linux: ['/usr/bin/tailscale', '/usr/local/bin/tailscale']
};

/** Tailnet addresses always sit in 100.64.0.0/10, so a stray result can't slip through. */
function isTailnetIp(ip) {
	const parts = ip.split('.').map(Number);
	return (
		parts.length === 4 &&
		parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) &&
		parts[0] === 100 &&
		parts[1] >= 64 &&
		parts[1] <= 127
	);
}

function firstIp(out) {
	if (!out || out.status !== 0 || !out.stdout) return null;
	const ip = out.stdout.trim().split('\n')[0].trim();
	return isTailnetIp(ip) ? ip : null;
}

function tailnetIp() {
	// PATH first — Windows needs a shell to resolve the .exe via PATHEXT. Passing
	// one command string rather than an args array keeps that lookup clear of
	// Node's shell-args deprecation warning.
	const onPath = firstIp(spawnSync('tailscale ip -4', { encoding: 'utf8', shell: true }));
	if (onPath) return onPath;
	// Then the known install locations, spawned directly so paths with spaces
	// need no shell quoting.
	for (const bin of INSTALL_PATHS[process.platform] ?? []) {
		if (!fs.existsSync(bin)) continue;
		const ip = firstIp(spawnSync(bin, ['ip', '-4'], { encoding: 'utf8' }));
		if (ip) return ip;
	}
	return null;
}

const env = { ...process.env };

if (!env.REACT_NATIVE_PACKAGER_HOSTNAME) {
	const ip = tailnetIp();
	if (ip) {
		env.REACT_NATIVE_PACKAGER_HOSTNAME = ip;
		// Plain ASCII: this console runs a non-UTF-8 codepage and mangles dashes.
		console.log(`[start] Tailscale is up - serving Metro on ${ip}`);
	} else {
		const example =
			process.platform === 'win32'
				? '$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.1.20"; npm start'
				: 'REACT_NATIVE_PACKAGER_HOSTNAME=192.168.1.20 npm start';
		console.warn(
			[
				'[start] No Tailscale address found.',
				'        Expo will fall back to the first network adapter it enumerates,',
				'        which may be a VPN or VM address your phone cannot reach.',
				'        If the QR code never connects, pin your LAN IP yourself:',
				`          ${example}`,
				''
			].join('\n')
		);
	}
}

const result = spawnSync('expo', ['start', ...process.argv.slice(2)], {
	stdio: 'inherit',
	env,
	shell: true
});

process.exit(result.status ?? 1);
