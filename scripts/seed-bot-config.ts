/**
 * One-time migration: seed bot_config collection from current config.ts files.
 *
 * Usage:
 *   cd Luna-Fantasy-Main && npx tsx scripts/seed-bot-config.ts
 *
 * This reads both Butler and Jester config.ts files, parses the dynamic settings,
 * and writes them to the bot_config collection. Existing documents are NOT overwritten
 * (uses updateOne with $setOnInsert) — safe to re-run.
 *
 * After seeding, bots will read from bot_config via ConfigReader and fall back to
 * config.ts if the document is missing.
 */

import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { readFile } from 'fs/promises';
import path from 'path';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('MONGODB_URI not set in .env / .env.local');
    process.exit(1);
}

const BUTLER_PATH = process.env.BUTLER_PROJECT_PATH || 'C:\\Users\\Admin\\Desktop\\Luna Bot\\LunaButlerMain';
const JESTER_PATH = process.env.JESTER_PROJECT_PATH || 'C:\\Users\\Admin\\Desktop\\Luna Bot\\LunaJesterMain';

// Brace-counting block extractor (same logic as config-writer.ts)
function extractBlock(source: string, key: string): string | null {
    const patterns = [
        new RegExp(`"${key}"\\s*:\\s*[\\{\\[]`),
        new RegExp(`${key}\\s*:\\s*[\\{\\[]`),
    ];

    let match: RegExpExecArray | null = null;
    for (const pat of patterns) {
        match = pat.exec(source);
        if (match) break;
    }
    if (!match) return null;

    const openChar = source[match.index + match[0].length - 1];
    const closeChar = openChar === '{' ? '}' : ']';
    const blockStart = match.index + match[0].length - 1;
    let depth = 1;
    let i = blockStart + 1;
    while (i < source.length && depth > 0) {
        const ch = source[i];
        if (ch === openChar) depth++;
        else if (ch === closeChar) depth--;
        if (ch === '"') {
            i++;
            while (i < source.length && source[i] !== '"') {
                if (source[i] === '\\') i++;
                i++;
            }
        }
        i++;
    }
    if (depth !== 0) return null;
    return source.slice(blockStart, i);
}

function cleanTs(ts: string): string {
    return ts
        .replace(/\r\n/g, '\n')
        .replace(/,(\s*[}\]])/g, '$1')
        .replace(/\s+as\s+\w+(\[\])?/g, '')
        .replace(/(?<![:"'])\/\/[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
}

function parseBlock(source: string, key: string): any {
    const raw = extractBlock(source, key);
    if (!raw) return null;
    try {
        return JSON.parse(cleanTs(raw));
    } catch {
        console.warn(`  Failed to parse "${key}"`);
        return null;
    }
}

function parseSimple(source: string, key: string): string | null {
    const match = source.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`));
    return match ? match[1] : null;
}

async function main() {
    const client = new MongoClient(MONGODB_URI!);
    await client.connect();
    const db = client.db('Database');
    const col = db.collection('bot_config');

    console.log('Connected to MongoDB. Reading config files...\n');

    // ── Butler ──
    const butlerContent = await readFile(path.join(BUTLER_PATH, 'config.ts'), 'utf-8');
    console.log('=== Butler Config ===');

    const butlerEconomy = {
        daily_reward: parseBlock(butlerContent, 'daily_reward'),
        salary: parseBlock(butlerContent, 'salary'),
        vip_reward: parseBlock(butlerContent, 'vip_reward'),
    };
    if (butlerEconomy.daily_reward) {
        await upsert(col, 'butler_economy', butlerEconomy);
        console.log('  butler_economy: seeded');
    }

    const butlerGames: Record<string, any> = {};
    for (const game of ['xo_game', 'rps_game', 'connect4_game', 'coinflip_game', 'hunt_game', 'roulette_game', 'luna21_game', 'steal_system']) {
        const parsed = parseBlock(butlerContent, game);
        if (parsed) butlerGames[game] = parsed;
    }
    if (Object.keys(butlerGames).length > 0) {
        await upsert(col, 'butler_games', butlerGames);
        console.log('  butler_games: seeded');
    }

    const levelSystem = parseBlock(butlerContent, 'level_system');
    if (levelSystem) {
        await upsert(col, 'butler_level_system', levelSystem);
        console.log('  butler_level_system: seeded');
    }

    const bankerSystem = parseBlock(butlerContent, 'banker_system');
    if (bankerSystem) {
        await upsert(col, 'butler_banking', bankerSystem);
        console.log('  butler_banking: seeded');
    }

    const butlerStatus = parseSimple(butlerContent, 'status');
    if (butlerStatus) {
        await upsert(col, 'butler_status', { text: butlerStatus, type: 'idle' });
        console.log('  butler_status: seeded');
    }

    const shops = parseBlock(butlerContent, 'shops');
    if (shops?.mells_selvair) {
        await upsert(col, 'butler_shop', shops.mells_selvair);
        console.log('  butler_shop: seeded');
    }

    // ── Jester ──
    const jesterContent = await readFile(path.join(JESTER_PATH, 'config.ts'), 'utf-8');
    console.log('\n=== Jester Config ===');

    // Game settings — extract each game individually (skip huge cards/factions)
    const gameSettingsBlock = extractBlock(jesterContent, 'game_settings');
    if (gameSettingsBlock) {
        const gameKeys = [
            'all_of_games', 'votegame', 'roulette', 'mafia', 'rps', 'guessthecountry',
            'bombroulette', 'magicbot', 'LunaFantasy', 'LunaFantasyEvent',
            'GrandFantasy', 'FactionWar'
        ];
        const gameSettings: Record<string, any> = {};
        for (const key of gameKeys) {
            const parsed = parseBlock(gameSettingsBlock, key);
            if (parsed) {
                // Strip cards from LunaFantasy and factions from FactionWar (managed separately)
                if (key === 'LunaFantasy') delete parsed.cards;
                if (key === 'FactionWar') delete parsed.factions;
                gameSettings[key] = parsed;
            }
        }
        if (Object.keys(gameSettings).length > 0) {
            await upsert(col, 'jester_game_settings', gameSettings);
            console.log('  jester_game_settings: seeded');
        }
    }

    const pointsSettings = parseBlock(jesterContent, 'points_settings');
    if (pointsSettings) {
        await upsert(col, 'jester_points_settings', pointsSettings);
        console.log('  jester_points_settings: seeded');
    }

    const jesterStatus = parseSimple(jesterContent, 'status');
    if (jesterStatus) {
        await upsert(col, 'jester_status', { text: jesterStatus, type: 'idle' });
        console.log('  jester_status: seeded');
    }

    // Moon stones config (for completeness — vendor_config already has some of this)
    const moonStones = parseBlock(jesterContent, 'moon_stones');
    if (moonStones) {
        await upsert(col, 'jester_moon_stones', moonStones);
        console.log('  jester_moon_stones: seeded');
    }

    console.log('\nDone! All config sections seeded to bot_config collection.');
    console.log('Existing documents were NOT overwritten (safe to re-run).\n');

    await client.close();
}

async function upsert(col: any, id: string, data: any) {
    await col.updateOne(
        { _id: id },
        {
            $setOnInsert: {
                data,
                updatedAt: new Date(),
                updatedBy: 'seed-script',
            },
        },
        { upsert: true }
    );
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
