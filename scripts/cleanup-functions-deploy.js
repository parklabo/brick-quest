#!/usr/bin/env node
import { readFileSync, writeFileSync, rmSync } from 'fs';

const pkgPath = 'packages/functions/package.json';
const sharedDst = 'packages/functions/_shared';

// Restore workspace:* dependency
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.dependencies['@brick-quest/shared'] = 'workspace:*';
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// Remove copied shared package
rmSync(sharedDst, { recursive: true, force: true });

console.log('Cleaned up after functions deploy');
