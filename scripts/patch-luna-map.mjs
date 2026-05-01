// Patch the live `bot_config._id="jester_luna_map"` Mongo doc directly.
//
// Why this exists: the Jester bot's getGameConfig / configReader pipeline
// SHALLOW-merges the Mongo doc on top of config.ts at runtime, so once a
// dashboard save writes a `jester_luna_map` doc, every later edit to
// config.ts is shadowed for the affected branches. Adding the Valecroft
// merchants and bumping artwork cache-bust tokens by editing config.ts
// alone has no effect — we have to write the data into the Mongo doc.
//
// This script is idempotent: re-running it just refreshes the timestamps
// and re-applies the same merchant entries. Safe to run again any time the
// dashboard wipes them or fresh art is uploaded.

import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const env = readFileSync(resolve('.env.local'), 'utf8');
for (const raw of env.split('\n')) {
    const line = raw.replace(/\r$/, '');
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const k = line.substring(0, eq);
    const v = line.substring(eq + 1).replace(/^["']|["']$/g, '').trim();
    if (/^[A-Z_][A-Z0-9_]*$/.test(k)) process.env[k] = v;
}

const URI = process.env.MONGODB_URL ?? process.env.MONGODB_URI;
if (!URI) { console.error('MONGODB_URL not in env'); process.exit(1); }

const client = new MongoClient(URI);
await client.connect();
const db = client.db('Database');
const col = db.collection('bot_config');

const NOW = Date.now();
// Cache-bust tokens — bumped on every run so re-uploads always invalidate.
const MAP_BUST = NOW;
const GF_MAP_BUST = NOW;
const AVELLE_BUST = 1777674820231; // Avelle portrait was uploaded earlier

// Valecroft family — the canonical 5 entries. Cassian uses his dedicated
// vendor portrait. The other 4 fall back to the LunaPairs card art until
// dedicated portraits exist on R2 (user can swap via dashboard).
const VALECROFT_ENTRIES = [
    {
        label: "Cassian Valecroft",
        content: "\nكاسيان فالكروفت – سيّد بازار العقارات\n\nفي قلب لونفور، حيث تُباع الجدران بثمن أعلى من السيوف، يجلس كاسيان فالكروفت، الابن الأصغر لعائلة فالكروفت العريقة.\nمن طاولته الفخمة يدير بازار العقارات، يمنح الأكواخ للمبتدئين، والقصور لمن أثبت اسمه في لونا.\n\nيُقال إنّه يعرف ثمن كل بيت قبل أن يُبنى، ويرى وزن كل صفقة قبل أن تُختم.\nلا يبيع جدراناً، بل يبيع مكاناً في تاريخ المدينة.\nمن يخرج من متجره بعقدٍ موقّع، يخرج وقد كسب اسماً، أو خسر سرّاً.\n\n“البيوت تُورَث، لكن المكان يُكتسَب.” – كاسيان\n\n# <#1450597284600615062>",
        image: `https://assets.lunarian.app/butler/vendors/RealEstateCassian.png?v=${MAP_BUST}`,
    },
    {
        label: "Vesper Valecroft",
        content: "\nڤيسبر فالكروفت – بطريرك العائلة\n\nبطريرك بيت فالكروفت، أقدم اسم في سجل لونفور، صاحب التوقيع الذي افتُتحت به أوّل صفحات المدينة.\nلا يجلس في البازار، ولا يقابل التاجر العادي - بل يستقبل من يستحقّون اسمه فقط في صالات منزله المرصّعة بصور أصحاب الأرض الأوائل.\n\nيُقال إنّ صمته يساوي ألف عقد، وإنّ نظرته تكفي لفسخ صفقة لم تُكتب بعد.\nمن أراد البيع الكبير… لا يكلّم كاسيان، بل يطلب جلسة مع ڤيسبر.\nومن نال جلسة معه… عاد بصفقة لا يعرف بها أحد، أو لم يعد أصلاً.\n\n“الأسماء تُكتب على الورق، أمّا التاريخ فيُحفر في الحجر.” – ڤيسبر",
        image: `https://assets.lunarian.app/LunaPairs/lunarians_vesper_valecroft.png?v=${MAP_BUST}`,
    },
    {
        label: "Dante Valecroft",
        content: "\nدانتي فالكروفت – يد العائلة في الظل\n\nالأخ الأكبر، الذراع التي تحمي ثروة فالكروفت من خارج الأسوار.\nبينما يعقد كاسيان الصفقات في البازار، يطوف دانتي بين الموانئ والممرّات والظلال،\nيتابع المنافسين، ويحفظ التوازن، ويُسكت الأصوات قبل أن تتحوّل إلى دعوى.\n\nلا يحمل لقباً رسمياً، لكنه يعرف كل اسم في لونفور قبل أن يُذكر.\nإن طُمست أوراق صفقة، أو اختفى منافس مزعج، فاسأل عن دانتي… ولا تتوقّع جواباً.\n\n“الورقة تُمحى، لكن الذاكرة تبقى.” – دانتي",
        image: `https://assets.lunarian.app/LunaPairs/lunarians_dante_valecroft.png?v=${MAP_BUST}`,
    },
    {
        label: "Alice Valecroft",
        content: "\nأليس فالكروفت – أمينة الخزائن\n\nالابنة الكبرى، وحارسة سجلات العائلة منذ كانت طفلة تجلس بجانب والدها ڤيسبر تحفظ الأسماء قبل الأرقام.\nلا تظهر كثيراً في البازار، بل تدير الخزائن والمكتبات الخاصة من غرفة بعيدة في المنزل،\nحيث تُحفظ كل العقود التي وقّعها فالكروفت منذ تأسيس لونفور.\n\nيُقال إنّها تعرف من يملك ماذا في المدينة قبل أن يعرف صاحبه نفسه،\nوإنّ ذاكرتها أدقّ من أيّ سجلٍ كُتب على ورق.\nمن خانه التوقيع، تُذكّره بكلمته. ومن نسي عقداً، تُعيد عليه السطور كأنّها كُتبت أمس.\n\n“ما يُكتب يُنسى. ما يُحفظ في رأس فالكروفت لا يُمحى.” – أليس",
        image: `https://assets.lunarian.app/LunaPairs/lunarians_alice_valecroft.png?v=${MAP_BUST}`,
    },
    {
        label: "Darian Valecroft",
        content: "\nداريان فالكروفت – وريث الجيل القادم\n\nأصغر فرع في شجرة العائلة، الابن الذي اختار أن يتعلّم قبل أن يحكم.\nيتنقّل بين البازار وقاعات والده وغرف أخته،\nيراقب، يستمع، ويحفظ كل صفقة كأنّها درسٌ يُعدّه ليومٍ ليس ببعيد.\n\nبعض التجار يستهينون به لصغر سنّه - وأولئك أوّل من يخسر طاولة معه.\nفمن وراء ابتسامته الهادئة، يخفي ذكاء فالكروفت كاملاً، وصبر ڤيسبر،\nوحدّة دانتي حين يلزم الأمر.\n\nيُقال إن من يتفاوض مع داريان اليوم، يفاوض رئيس عائلة فالكروفت غداً.\n\n“الإرث لا يُورث… الإرث يُكسَب.” – داريان",
        image: `https://assets.lunarian.app/LunaPairs/lunarians_darian_valecroft.png?v=${MAP_BUST}`,
    },
];

const doc = await col.findOne({ _id: 'jester_luna_map' });
if (!doc) { console.error('jester_luna_map not found'); await client.close(); process.exit(1); }
const data = doc.data ?? {};
const map = data.map ?? (data.map = {});
const cats = Array.isArray(map.categories) ? map.categories : [];

// Bump the main map artwork URL.
if (typeof map.image === 'string') {
    const stripped = map.image.split('?')[0];
    map.image = `${stripped}?v=${MAP_BUST}`;
    console.log(`map.image  → ${map.image}`);
}

// Find تجار لونا category and merge Valecroft + bump Avelle.
const merchants = cats.find(c => c?.name === 'تجار لونا');
if (!merchants || !Array.isArray(merchants.menu)) {
    console.error('Could not locate تجار لونا category — aborting');
    await client.close();
    process.exit(1);
}

// Bump Avelle Adar's portrait if present.
const avelle = merchants.menu.find(m => m?.label === 'Avelle Adar');
if (avelle) {
    avelle.image = `https://assets.lunarian.app/characters/avelle-adar.png?v=${AVELLE_BUST}`;
    console.log(`Avelle      → ${avelle.image}`);
}

// Upsert Valecroft entries — replace if label exists, append otherwise.
let added = 0, replaced = 0;
for (const entry of VALECROFT_ENTRIES) {
    const idx = merchants.menu.findIndex(m => m?.label === entry.label);
    if (idx >= 0) {
        merchants.menu[idx] = entry;
        replaced++;
    } else {
        merchants.menu.push(entry);
        added++;
    }
}
console.log(`Valecroft  → ${added} added, ${replaced} replaced`);

// Bump Grand Fantasy banner inside the games category if it exists.
for (const cat of cats) {
    if (!Array.isArray(cat?.menu)) continue;
    for (const item of cat.menu) {
        if (item?.label === 'Grand Fantasy' && typeof item.image === 'string') {
            const stripped = item.image.split('?')[0];
            item.image = `${stripped}?v=${GF_MAP_BUST}`;
            console.log(`Grand Fant. → ${item.image}`);
        }
    }
}

// Surgical $set on data.map only — leaves the rest of the doc alone.
await col.updateOne(
    { _id: 'jester_luna_map' },
    {
        $set: {
            'data.map': map,
            updatedAt: new Date(),
        },
    },
);
console.log('✓ jester_luna_map updated');

await client.close();
