#!/usr/bin/env node
// Pick an address the phone can actually reach, and hand it to Expo via
// REACT_NATIVE_PACKAGER_HOSTNAME.
//
// Left alone, Expo advertises the first non-internal IPv4 that Node enumerates.
// On a machine with a VPN or a hypervisor installed that is very often an
// address no phone can route to -- here it picks the ProtonVPN adapter -- and
// the failure is quietly confusing rather than loud: the bundle may still load
// from cache while the Fast Refresh socket never connects, so edits stop
// reaching the device and Metro logs "connection terminated with Device ...
// after not responding for 60 seconds".
//
// Order of preference:
//   1. REACT_NATIVE_PACKAGER_HOSTNAME, if you already set one.
//   2. The Tailscale address, which works from anywhere on the tailnet -- the
//      phone does not have to share this machine's Wi-Fi.
//   3. A real LAN address (Wi-Fi or Ethernet), for a phone on the same network.
//
// Console output here stays ASCII: this machine's console is cp932 and anything
// else arrives as mojibake.
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');

/** `tailscale` is usually not on PATH on Windows, so check where it installs. */
const TAILSCALE_BINARIES = [
	'tailscale',
	'C:\\Program Files\\Tailscale\\tailscale.exe',
	'C:\\Program Files (x86)\\Tailscale\\tailscale.exe',
	'/Applications/Tailscale.app/Contents/MacOS/Tailscale',
	'/usr/local/bin/tailscale',
	'/usr/bin/tailscale'
];

/** Adapters that exist on a dev box but that a phone can never route to. */
const UNREACHABLE = /proton|vpn|virtualbox|vmware|hyper-v|bluetooth|loopback|pseudo|docker|wsl/i;

/** Adapters actually worth advertising, best first. */
const PREFERRED = /wi-?fi|wlan|ethernet|^en\d/i;

function tailscaleIp() {
	for (const bin of TAILSCALE_BINARIES) {
		const isPath = bin.includes('/') || bin.includes('\\');
		if (isPath && !fs.existsSync(bin)) continue;
		const run = spawnSync(bin, ['ip', '-4'], { encoding: 'utf8' });
		if (run.status !== 0 || !run.stdout) continue;
		const ip = run.stdout.trim().split('\n')[0].trim();
		if (ip) return ip;
	}
	return null;
}

function lanIp() {
	const candidates = [];
	for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
		if (UNREACHABLE.test(name)) continue;
		for (const addr of addrs || []) {
			if (addr.family !== 'IPv4' || addr.internal) continue;
			// 169.254.x is link-local: an adapter that never got a lease.
			if (addr.address.startsWith('169.254.')) continue;
			candidates.push({ name, ip: addr.address });
		}
	}
	const preferred = candidates.find((c) => PREFERRED.test(c.name));
	return preferred || candidates[0] || null;
}

const env = { ...process.env };

if (env.REACT_NATIVE_PACKAGER_HOSTNAME) {
	console.log(`Dev server host: ${env.REACT_NATIVE_PACKAGER_HOSTNAME} (from the environment)`);
} else {
	const tailnet = tailscaleIp();
	const lan = lanIp();
	if (tailnet) {
		env.REACT_NATIVE_PACKAGER_HOSTNAME = tailnet;
		console.log(`Dev server host: ${tailnet} (tailscale)`);
		if (lan) {
			console.log(`  Phone not on the tailnet? Use the ${lan.name} address instead:`);
			console.log(`  REACT_NATIVE_PACKAGER_HOSTNAME=${lan.ip} npm start`);
		}
	} else if (lan) {
		env.REACT_NATIVE_PACKAGER_HOSTNAME = lan.ip;
		console.log(`Dev server host: ${lan.ip} (${lan.name})`);
	} else {
		console.log('Dev server host: letting Expo choose -- no tailnet or LAN address found.');
		console.log('  If the phone cannot connect: REACT_NATIVE_PACKAGER_HOSTNAME=<ip> npm start');
	}
}

// Default to Expo Go.
//
// `expo-dev-client` was a dependency until the Skia foil was proven to run in
// Expo Go, and its presence alone was enough to make the Expo CLI assume the
// custom native app was the target: it printed
// `exp+concard://expo-development-client/?url=...` deep links, which do
// nothing unless that build is installed on the phone. The package is gone, so
// this flag is belt-and-braces -- but it keeps that failure from coming back
// silently if anything ever pulls the package in again.
const args = process.argv.slice(2);
const picksTarget = args.some((a) => ['--go', '-g', '--dev-client', '-d'].includes(a));
if (!picksTarget) {
	args.push('--go');
	console.log('Target: Expo Go.');
}

const result = spawnSync('expo', ['start', ...args], {
	stdio: 'inherit',
	env,
	shell: true
});

process.exit(result.status ?? 1);
