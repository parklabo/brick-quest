#!/usr/bin/env node
import { readFileSync, writeFileSync, cpSync, rmSync } from 'fs';

const pkgPath = 'packages/functions/package.json';
const sharedSrc = 'packages/shared';
const sharedDst = 'packages/functions/_shared';

// Copy shared package into functions directory
rmSync(sharedDst, { recursive: true, force: true });
cpSync(sharedSrc, sharedDst, { recursive: true });

// Replace workspace:* with file:./_shared
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.dependencies['@brick-quest/shared'] = 'file:./_shared';
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

console.log('Prepared functions for deploy: shared copied, workspace dep replaced');
