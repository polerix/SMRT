#!/usr/bin/env node
/**
 * validate.js — SMRT content schema validator
 *
 * Usage:
 *   node validate.js game/security_adventure.json
 *   node validate.js path/to/any-game-data.json
 *
 * Exits 0 on success, 1 on validation errors.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Load AJV ────────────────────────────────────────────────────────────────
let Ajv;
try {
    Ajv = require('ajv');
    // ajv v8 exports default as a class
    if (Ajv.default) Ajv = Ajv.default;
} catch {
    console.error('❌  AJV not found. Run: npm install');
    process.exit(1);
}

const ajv = new Ajv({ allErrors: true, strict: false });

// ── Resolve file paths ───────────────────────────────────────────────────────
const cwd       = process.cwd();
const schemaPath = path.resolve(cwd, 'game/game.schema.json');
const dataPath   = process.argv[2]
    ? path.resolve(process.argv[2])
    : null;

if (!dataPath) {
    console.error('Usage: node validate.js <game-data.json>');
    process.exit(1);
}

// ── Read files ───────────────────────────────────────────────────────────────
let schema, data;

try {
    schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
} catch (e) {
    console.error(`❌  Could not read schema: ${schemaPath}\n    ${e.message}`);
    process.exit(1);
}

try {
    data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
} catch (e) {
    console.error(`❌  Could not read/parse data file: ${dataPath}\n    ${e.message}`);
    process.exit(1);
}

// ── Validate ─────────────────────────────────────────────────────────────────
const validate = ajv.compile(schema);
const valid    = validate(data);

if (valid) {
    const worldId = data.world?.id ?? 'unknown';
    const sceneCount  = Object.keys(data.scenes  ?? {}).length;
    const actorCount  = Object.keys(data.actors  ?? {}).length;
    const scriptCount = Object.keys(data.dialogue ?? {}).length;
    const badgeCount  = Object.keys(data.badges  ?? {}).length;

    console.log(`\n✅  ${path.basename(dataPath)} is valid\n`);
    console.log(`    World    : ${worldId}`);
    console.log(`    Scenes   : ${sceneCount}`);
    console.log(`    Actors   : ${actorCount}`);
    console.log(`    Scripts  : ${scriptCount}`);
    console.log(`    Badges   : ${badgeCount}\n`);
    process.exit(0);
} else {
    console.error(`\n❌  ${path.basename(dataPath)} failed schema validation:\n`);

    const errors = validate.errors ?? [];
    errors.forEach((err, i) => {
        const loc  = err.instancePath || '(root)';
        const msg  = err.message ?? '';
        const extra = err.params ? JSON.stringify(err.params) : '';
        console.error(`  ${i + 1}. [${loc}] ${msg} ${extra}`);
    });

    console.error(`\n  Total errors: ${errors.length}\n`);
    process.exit(1);
}
