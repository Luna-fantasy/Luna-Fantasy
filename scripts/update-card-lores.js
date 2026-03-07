/**
 * Update characters collection with lore (EN + AR)
 * Source: Website_lores_EN_fixed.pdf
 *
 * Updates characters that currently have no lore field.
 * Matches by character name (name.en).
 *
 * Usage: node scripts/update-card-lores.js
 */

const { MongoClient } = require("mongodb");
const path = require("path");
const fs = require("fs");

// Load .env.local manually (no dotenv dependency needed)
const envPath = path.resolve(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match && !process.env[match[1].trim()]) {
    process.env[match[1].trim()] = match[2].trim();
  }
}

// Character lores keyed by name.en (case-insensitive match)
const LORES = {
  // ── Beasts ──
  "Abyssal Leech": {
    en: "A blood-hungry leech from Luna's dark rivers that clings until nothing remains but bone.",
    ar: "دودة دموية من أنهار لونا المظلمة، لا تترك ضحيتها حتى لا يبقى منها إلا العظام.",
  },
  "Bigfoot": {
    en: "A massive forest brute—shy by nature, but it turns savage the moment someone stares too long.",
    ar: "وحش الغابات الضخم، خجول بطبعه لكنه يغضب إذا حدق به أحد.",
  },
  "Cave Stalker": {
    en: "A cavern stalker said to have once been human—warped by the Shaman's curses into something else.",
    ar: "وحش الكهوف؛ قيل إنه كان من البشر، لكن أصيب ببعض من لعنات الشامان.",
  },
  "Cursed Rat": {
    en: "Any Lunarian who reaches for Chaos and fails to master it is twisted into a grotesque creature.",
    ar: "كل لوناري سعى إلى قوة الفوضى ولم يستطع التحكم بها يُمسخ إلى كائن غريب.",
  },
  "Cursed Spider": {
    en: "Common in Luna's forbidden woods—an abomination so wrong you can't tell if it's ape or spider.",
    ar: "في غابات لونا المحرّمة سترى هذا العنكبوت بكثرة؛ لا تدري أهو قرد أم عنكبوت.",
  },
  "Forest Monster": {
    en: "A swamp-bred forest monster that leaves Lunarians alone—yet tears hunters apart on sight.",
    ar: "وحش الغابات يعيش في نطاق مستنقع ضخم ولا يتعرض للوناريين، لكنه شرس ضد الصيادين.",
  },
  "Hybrid Lion": {
    en: "A hybrid lion of mixed bloodlines that prowls the mountains, preying on small and mid-sized beasts.",
    ar: "هجين ما بين عدة فصائل، يتواجد في المناطق الجبلية ويصطاد الحيوانات متوسطة الحجم والصغيرة.",
  },
  "Mountain Grizzly": {
    en: 'A mountain "ghost" grizzly that attacks anything it meets—even creatures of its own kind.',
    ar: "يُعتبر شبحًا من أشباح الجبال؛ يهاجم الجميع حتى لو كانوا من نفس فصيله.",
  },
  "Mountains Freak": {
    en: "A vile mountain lurker that ambushes caravans—slaughtering horses and camels purely for sport.",
    ar: "هذا المخلوق الخبيث يترصد بالجبال كل قافلة ويهجم على الأحصنة والجمال ويقتلها من باب التسلية.",
  },
  "Night Fangs": {
    en: "An ugly nocturnal feeder that drains livestock and horses; its venom finishes what its bite starts.",
    ar: "مخلوق قبيح يقتات على دم الماشية والأحصنة، وتموت بسبب السم في أنيابه.",
  },
  "Orc Warchief": {
    en: "An orc war-chief with no mercy—an infamous butcher who commands a hundred orc soldiers.",
    ar: "فائد من جيوش الأورك لا يعرف الرحمة ومقاتل شرس يقود 100 جندي من الأورك.",
  },
  "River Drowner": {
    en: "In every river, this cursed thing seizes the ankles of those who step in—dragging them down to drown.",
    ar: "في كل نهر يجب أن ترى هذا اللعين يمسك أرجل كل من وطئ قدمه على النهر لإغراقه.",
  },
  "Swamp Hag": {
    en: "A swamp hag who bargains with the weak-minded; every deal ends in a curse—or a corpse.",
    ar: "تعيش في المستنقعات وتقدم للضعاف النفوس صفقات، وتنتهي إما بلعنة لهم أو مقتل أحدهم.",
  },

  // ── Colossals (Giants) ──
  "Earth Wyrm": {
    en: "Each time it surfaces, the mountains shift and split—its passage brings only ruin.",
    ar: "في كل خروج لها يحصل تغيير في تضاريس المنطقة الجبلية ولا تجلب إلا الدمار.",
  },
  "Kong": {
    en: "They say it rivals the last giant-knights in size—slightly smaller in truth. It ignores Lunarians and hunts only forest beasts.",
    ar: "قيل إنه يضاهي آخر فرسان العمالقة بالحجم لكنه أصغر بقليل؛ لا يهاجم اللوناريين، فقط الوحوش في الغابات.",
  },
  "Magma Titan": {
    en: "A volcano-dwelling titan that feeds on molten magma; it cannot survive beyond the crater's heat.",
    ar: "يعيش في البراكين ويتغذى على الحمم البركانية؛ لا يستطيع النجاة أبدًا خارج البراكين.",
  },
  "Monolith": {
    en: "An ancient monolith that carries ruins on its back and moves only once every 150 years.",
    ar: "هذا الكائن الأثري يحمل أطلالًا على ظهره ويتحرك كل 150 سنة مرة.",
  },
  "Sea Colossus": {
    en: "If an explosion-like roar reaches you at sea, know this: you're already dead.",
    ar: "إذا سمعت صوتًا يشبه الانفجار وأنت في المحيط فاعرف أنك هالك لا محالة.",
  },
  "The Forgotten Titan": {
    en: "Luna's oldest titan—seen by only a handful, dismissed by the world as a myth... until it wakes.",
    ar: "هذا العملاق هو أعتق وأقدم عملاق في لونا؛ لم يره إلا قلة ولا زال لا أحد يصدق وجوده.",
  },

  // ── Dragons ──
  "Bloodforged Dragon": {
    en: "Guardian of the Bloodline—servant to the Blood Priest, granting his followers brutal strength.",
    ar: "حارس معشر سلالة الدم والذين يتبعون كاهن الدم، ويمدهم بطاقة وقوة ساحقة.",
  },
  "Bloom Drake": {
    en: "It looks gentle—until you step into its private garden. Then it becomes pure violence.",
    ar: "يبدو لطيفًا لكنه شرس جدًا إذا اقتربت من الحديقة الخاصة به.",
  },
  "Dune Dracon": {
    en: "Luna's deserts are never empty of oddities; this dracon is one of their living emblems.",
    ar: "لا تخلو صحراء لونا من الأشياء الغريبة، وهذا التنين أحد رموز صحراء لونا.",
  },
  "Echo Dragonet": {
    en: "The smallest and most hunted of dragonkind—its beautiful call betrays it to every predator.",
    ar: "أصغر أنواع التنانين وأكثر عرضة للقتل؛ لديه صوت جميل جدًا لكنه يجلب المعتدين إليه.",
  },
  "Frost Dragon": {
    en: "Known as the White Beast—its fire is ice, and no one dares climb Luna's frozen peaks.",
    ar: "يُعرف بالوحش الأبيض؛ حتى ناره جليد، ولا أحد يجرؤ أن يتسلق جبال لونا الثلجية.",
  },
  "Glacial Dragon": {
    en: "Asleep most of the time—when it wakes, a thousand beasts from the snowy forests become its feast.",
    ar: "نائم معظم الوقت، وإذا استيقظ على الأقل 1000 حيوان من غابات لونا الثلجية يصبحون وليمة له.",
  },
  "Infernal Dragon": {
    en: "A rare infernal breed from Luna's volcanic mountains—said to be among the oldest bloodlines.",
    ar: "يعيش في جبال لونا البركانية؛ قيل إنه من أقدم الفصائل في لونا وبوجد منه عدد قليل.",
  },
  "Man Eater": {
    en: "The nightmare of Sirania's villages—devouring Lunarians, especially men, as its only meal.",
    ar: "كابوس قرى سيرانيا؛ يفضل أكل اللوناريين والرجال منهم ويعتبرهم الوجبة الوحيدة له.",
  },
  "Moss Drake": {
    en: "The hardest dragon to spot—after feeding, it rests its head to the earth and vanishes into the landscape.",
    ar: "أصعب تنين لكي تراه؛ يأكل الأعشاب والأشجار، ثم يُسند رأسه للأرض فيختفي تمامًا مع الطبيعة.",
  },
  "Obsidian Dragon": {
    en: "Sentinel of Luna's mines—its presence kept thieves away for centuries.",
    ar: "حارس مناجم لونا؛ وبفضله لم يجرؤ لص على الاقتراب من المنجم لمئات السنين.",
  },
  "Ocean Drake": {
    en: "Strong and agile—the only of its kind that swims, hunting exclusively in the sea.",
    ar: "قوي ورشيق، والوحيد من فصيله القادر على السباحة؛ لا يصيد إلا من البحر.",
  },
  "Pearl Draconis": {
    en: "The rarest and most beautiful—pearl-bodied, silk-soft, and its sight is said to lift the heart.",
    ar: "أندر التنانين وأجملهم؛ جسدها من اللؤلؤ بالكامل وجلدها أنعم من الحرير، ورؤيتها تجلب السرور.",
  },
  "Shadow Drake": {
    en: "Impossible to track or predict—no one knows where it emerges from, and you never hear it strike.",
    ar: "صعب التنبؤ به وصعب رصده؛ لا تعلم من أين يخرج أو يهاجم، ورغم ضخامة جسده يستحيل أن تسمعه وهو ينقض.",
  },

  // ── Lunarians (Knights) ──
  "Aurel": {
    en: "The knight who mastered the Pegasus—one of the few able to challenge Sable, the undefeated.",
    ar: "الفارس الذي استطاع أن يمنطي البيغاسوس، والوحيد الذي يستطيع مقارعة (سيبل) الذي لا يُهزم.",
  },
  "Elite Trooper": {
    en: "Lunvor's elite troopers—its feared police force. No one escapes them, especially with their speed.",
    ar: "من فرقة النخبة ويُسمّون بشرطة لونفور؛ لا أحد منهم يستطيع الإفلات خصوصًا أنهم الأسرع.",
  },
  "Night Walker": {
    en: "Relentless vampire-hunter, roaming Lunvor's streets at night to purge the bloodborn.",
    ar: "لا يكل عن البحث عن مصاصي الدماء؛ يتجول في شوارع لونفور ليلًا للقضاء عليهم.",
  },
  "Prism Knight": {
    en: "Guardians of Luna's guest hall—armed with Mastermind-forged blades, they do not leave until all have departed.",
    ar: "فرسان قاعة الضيوف في لونا؛ حتى رمحهم من نصل الماسترمايند، ولا يبرحون القاعة حتى انصراف الجميع.",
  },
  "Sable": {
    en: "Rumored to be Underworld-born, but he isn't. Never defeated—so dangerous even Movarth avoided him.",
    ar: "يقال إنه من العالم السفلي في لونا لكنه ليس كذلك؛ لم يُهزم قط حتى إن موفارت تحاشى الصدام معه.",
  },
  "Talon Warden": {
    en: "Elite of the Falcon unit—Luna's first line of defense against assassins.",
    ar: "نخبة فريق الصقور، الأول في خط الدفاع الأول في مواجهة المغتالين في لونا.",
  },
  "Dina": {
    en: "Dina the Seer—keeper of secrets for both Mastermind I and Mastermind II.",
    ar: "العرافة دينا، وتُعتبر أمينة السر لكلا الماسترمايند.",
  },

  // ── Mythical Creatures ──
  "Astral Manta": {
    en: "A mythical creature named in Luna's ancient book—its song is beautiful, its presence overwhelming.",
    ar: "إحدى المخلوقات الأسطورية المذكورة في كتاب لونا العتيق؛ يملك صوتًا جميلًا وحضورًا مهيبًا.",
  },
  "Basilisk": {
    en: "It dwells among ruins and rocky peaks; its parts sell for millions of Lunari—especially the eye.",
    ar: "يعيش ما بين الأطلال والجبال الصخرية؛ تُباع أعضاؤه بملايين من اللوناري، خاصة عينه.",
  },
  "Eclipse Stag": {
    en: "The Eclipse Stag appears only during a full eclipse—villagers chase the sight, but only the lucky are granted it.",
    ar: "غزال الكسوف الكامل لا يظهر إلا وقت الكسوف؛ يسعى سكان القرى لرؤيته ولا يحظى به إلا من كان محظوظًا.",
  },
  "Grim Shadow": {
    en: "Any who try to enter Luna unlawfully—without the main gate—are hunted down by this spectral wolf.",
    ar: "كل من حاول يدخل إلى لونا بطرق غير شرعية ولم يدخل من بوابة العالم الرئيسية ظهر هذا الذئب الطيفي وقضى عليه.",
  },
  "Lunar Scarab": {
    en: "A legendary scarab that feeds on lunar dust, leaving trails that send trackers the wrong way.",
    ar: "حشرة أسطورية تتغذى على الغبار القمري، وتترك خلفها أثرًا يضلّل المتعقبين.",
  },
  "Moon Wyrm": {
    en: "A serpentine wyrm burrowing beneath silver sands—sensing vibrations and striking from below.",
    ar: "كائن أفعواني يحفر تحت الرمال الفضية؛ يلتقط الذبذبات ويهاجم من تحت الأرض.",
  },

  // ── Supernaturals ──
  "Moonglass Master": {
    en: "Guardian of moonglass secrets—shaping light and shadow like substance, forging shard-mirrors that reveal the unseen.",
    ar: "حارس أسرار الزجاج القمري؛ يشكل الضوء والظل كأنهما مادة بين يديه، ويصنع من الشظايا مرايا ترى ما لا يُرى.",
  },
  "The Shallow": {
    en: "An ancient, immensely powerful being that feeds on lunar energy—colossal in size, rivaling sea giants in length.",
    ar: "مخلوق عتيق وقوي جدًا يعيش على طاقة القمر؛ يعتبر عملاقا ومقارنًا لعمالقة البحر طوالًا.",
  },
  "Banshee": {
    en: "Haunting old, dark palaces—approaching is lethal. Its scream alone is a killing blade.",
    ar: "تعيش في القصور القديمة والمظلمة؛ الاقتراب منها خطر. تملك حنجرة جدًا فتاكة تقتل بمجرد الصراخ.",
  },
  "Blood Fiend": {
    en: "It smells blood from afar and excels at hiding, stalking patiently before it strikes.",
    ar: "يشم رائحة الدم من مسافات بعيدة ويمتاز بالتخفي والترصد.",
  },
  "Doppelganger": {
    en: "One of Lunvor's deadliest—able to copy anyone's form... and their power along with it.",
    ar: "من أخطر الكائنات في لونفور؛ قادر على نسخ هيئة أي شخص، والجنون أنه ينسخ قوته كذلك.",
  },
  "Dullahan": {
    en: "A terrifying legendary warrior whose appearances are always a mystery—no one knows who it's waiting for.",
    ar: "مقاتل أسطوري مخيف؛ ظهوره محيّر دائمًا، لا أحد يعلم من ينتظر في ذلك المكان.",
  },
  "Moon Howler": {
    en: "Cursed by the forbidden-forest Shaman—mutated into a wolf for most of the month, becoming a man only for one full-moon night.",
    ar: "أحد المصابين بلعنات شامان ساحرة الغابة المحرمة؛ يعيش طوال الشهر ذئبًا ممسوخًا ويتحول لرجل عند اكتمال القمر ليلة واحدة فقط.",
  },
  "Necromancer": {
    en: "Commands the dead for hours at a time—and can even speak with some of them.",
    ar: "يتحكم بكل من سقطوا موتى لساعات، ويستطيع الحديث مع بعضهم.",
  },
  "Night Crawler": {
    en: "One of Luna's most savage horrors—active only at night, yet vulnerable to lunar-forged weapons.",
    ar: "من أشد الكائنات في لونا؛ يخرج ليلًا فقط لكنه ضعيف أمام جميع الأسلحة القمرية.",
  },
  "Shadow Stalker": {
    en: "It walks like shadow—unheard, unfelt, unseen, until the moment it's too late.",
    ar: "يحاكي الظل عند المشي؛ لا يُسمع به ولا يحس به أحد، تراه فقط عندما يفوت الأوان.",
  },
  "Shaman": {
    en: "The grand witch of Luna's forbidden forest—most of its horrors are born from her curses and black magic.",
    ar: "المشعوذة الكبرى في غاية لونا المحرمة؛ معظم الأشياء الغريبة بسبب لعناتها وسحرها الأسود.",
  },
  "The Countess": {
    en: "A high-ranking vampiric Countess of immense influence—over a thousand years old, with a vast bloodline in Luna.",
    ar: "ذات نفوذ قوي ومن أعلى درجات مصاصين الدماء؛ عمرها يفوق الألف سنة ولها سلالة كبيرة في لونا.",
  },
  "The Silent Ancient": {
    en: "The first vampire in history—over 4,000 years old, living in isolation. Rumor says it can kill 500 people in ten seconds.",
    ar: "مصاص الدماء الأول في التاريخ؛ عمره يتعدى 4000 سنة، يعيش منعزلًا وجيدًا. يقال إنه يقضي على 500 شخص في 10 ثوان.",
  },
  "The Weaver": {
    en: "Once a victim of the Shaman—she twisted her curse into a new one, embraced a new identity, and became among the forest's deadliest.",
    ar: "إحدى ضحايا الشامان سابقًا؛ حولت لعنتها إلى لعنة بعد اعتناق هويتها الجديدة وأصبحت من أخطر مخلوقات الغابة.",
  },
  "Warlock": {
    en: "The noble vampires' personal warlock—creator of the spell that lets them walk beneath the moon's strongest light.",
    ar: "الساحر الخاص لأسرة مصاصين الدماء الرفيعة؛ ساعدهم بتعويذة تجعلهم يخرجون تحت أقوى ضوء للقمر.",
  },
  "Wendigo": {
    en: "The embodiment of greed and hunger—prowling snowy Orsinia, impossibly fast, attacking anything in blind frenzy.",
    ar: "تجسيد للطمع والجوع؛ يجول في أورسينيا الثلجية، سريع جدًا ويهاجم الجميع دون وعي.",
  },

  // ── Underworld ──
  "Banished General": {
    en: "Once an unrivaled fighter in Luna—now a commander among the Underworld's armies.",
    ar: "كان مقاتلًا لا ينشق له غبار في لونا، والآن هو من قادة جيش العالم السفلي.",
  },
  "Dark Demon": {
    en: "The Underworld King's right hand—its main strike force and foremost advisor.",
    ar: "الساعد الأيمن والقوة الضاربة في العالم السفلي، وهو المستشار الأول لملك العالم السفلي.",
  },
  "Death Serpent": {
    en: "Once the Moon Serpent, now the Death Serpent—when something dies in Luna soaked in hatred, it may rise again in the Underworld.",
    ar: "ثعبان القمر الذي تحول اسمه إلى ثعبان الموت؛ عندما يموت شيء في لونا وتكون الكراهية عالية قد يعيش مرة أخرى في العالم السفلي.",
  },
  "Grave Titan": {
    en: "Keeper of graveyards—judging whether a fallen being is worthy of joining the Underworld.",
    ar: "يحرس المقابر ويعطي فرصة لأي كائن إن كان يستحق أن ينضم للعالم السفلي.",
  },
  "Grim Reaper": {
    en: "Deployed only to harvest the souls of Underworld warlords who fail their duties.",
    ar: "يُرسل فقط لحصد أرواح أسياد حرب العالم السفلي إذا تخاذلوا في مهامهم.",
  },
  "Judge Of Death": {
    en: "His battle record crowned him Judge of Death—one of the Underworld army's strongest warlords, honored in his realm.",
    ar: "سجله في المعارك جعله قاضيًا للموت؛ من أقوى أسياد الحرب في جيش العالم السفلي وله حفاوة في عالمه.",
  },
  "Psycho Jailer": {
    en: "Those who enter his cell never return the same—either they serve the dark, or become part of his eternal prison.",
    ar: "ومن يدخل زنزانته لا يخرج كما كان؛ إما يخدم الظلام أو يصبح جزءًا من سجنه الأبدي.",
  },
  "Puppet Master": {
    en: "A corpse-puppeteer who can mobilize an entire dead army—one of the Underworld's winning cards.",
    ar: "لديه قدرة في تحريك جيش كامل من الجثث ويُعتبر إحدى الورقات الرابحة في جيش العالم السفلي.",
  },
  "The Hatred": {
    en: "It never leaves the Underworld—bound to guard a cave for millennia. Its powers are unknown... even its name is disputed.",
    ar: "لا يخرج من العالم السفلي أبدًا وبالتجديد الكهف المكلّف بحراسته منذ آلاف السنين؛ قدراته غير معروفة ولا حتى اسمه.",
  },
  "Underworld Guardian": {
    en: "Once a Moon Guard of Luna, slain in the Great Chaos War—his hatred claimed him and dragged him into the Underworld's ranks.",
    ar: "كان أحد حراس القمر في لونا وقُتل في حرب الفوضى الكبرى؛ الآن استولت الكراهية عليه وألحقته بصفوف العالم السفلي.",
  },

  // ── Warriors ──
  "Bog": {
    en: "The only blacksmith of Luna's desert—also a formidable warrior, and the one who personally trained Bonk the Destroyer.",
    ar: "الحداد الوحيد في صحراء لونا، لكنه أيضًا محارب قوي؛ وهو من درّب بونك المدقر بنفسه.",
  },
  "Bonk The Juggernaut": {
    en: "Can shatter a house with a single punch—living in Luna's desert, born from a poor tribe.",
    ar: "قادر على تحطيم منزل بلكمة واحدة؛ يعيش في صحراء لونا وينتمي لأحد العشائر الفقيرة.",
  },
  "Crows Leader": {
    en: "Leader of the Crows—fighters so skilled that even their weakest can defeat a Luna knight.",
    ar: "قائد جماعة الغربان المعروفين بمهارتهم العالية بالقتال؛ أقل مقاتل منهم قادر أن يهزم فارسًا من فرسان لونا.",
  },
  "Dune Huntress": {
    en: "Aim set on hunting the desert's rarest creatures—thanks to Seluna, who acquires rare finds through her hunter friend.",
    ar: "وضعت هدفًا في صيد أندر المخلوقات في الصحراء؛ وهذا من حسن سيلونا التي تأخذ من صديقتها الصيادة مقتنيات نادرة.",
  },
  "Helm Smasher": {
    en: "A mercenary who sells his services across Luna's taverns—never underestimated, rarely survived.",
    ar: "محارب مرتزق يعرض خدماته للبيع في كل حانات لونا، ولا يُستهان به أبدًا.",
  },
  "Nomad Assassin": {
    en: "From a desert assassin clan—trained in every form of killing, with a style no one can imitate.",
    ar: "ينتمي لعشيرة المغتالين في الصحراء؛ مدرّبون ومتمرسون على جميع عمليات الاغتيال، لا أحد يستطيع تقليد أسلوبهم.",
  },
  "Ruins Scout": {
    en: "Risks his life more than anyone—yet is the most useful. No ruin in the desert escapes his search.",
    ar: "أكثر شخص يعرض حياته للخطر، لكنه أيضًا الأكثر فائدة؛ لا يوجد أطلال في الصحراء إلا ونبشها.",
  },
  "The Crag Mercenary": {
    en: "A powerful mercenary in snowy Orsinia, selling protection to caravans—because nobody is safe in that frozen city.",
    ar: "مرتزق قوي يعيش في أورسينيا ويعرض خدمات الحماية للقوافل؛ الجميع يعلم أن لا أحد يمأمن في مدينة أورسينيا الثلجية.",
  },
  "Zan The Berserker": {
    en: "Zan the Berserker lives in Luna's forests with his family—raiding to secure food and supplies.",
    ar: "زان صاحب الاسم الرنان يعيش في غابات لونا في كوخ مع عائلته؛ يعتمد على السطو لتأمين الطعام والمؤونة.",
  },
  "Zarkan": {
    en: "Living in Luna's desert, once part of Movarth's army—now honing blacksmithing skills under Bog.",
    ar: "يعيش في صحراء لونا وكان في الماضي في جيش موفارت، لكنه يسعى لتطوير مهاراته في الحدادة مع بوغ.",
  },
};

// Build a case-insensitive lookup
const loreLookup = new Map();
for (const [name, lore] of Object.entries(LORES)) {
  loreLookup.set(name.toLowerCase(), lore);
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI not set. Add it to .env.local");
    process.exit(1);
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db("Database");
  const coll = db.collection("characters");

  const chars = await coll.find({}).toArray();
  console.log(`Found ${chars.length} characters in DB\n`);

  let updated = 0;
  let alreadyHadLore = 0;
  const matched = new Set();

  for (const char of chars) {
    const name = typeof char.name === "string" ? char.name : char.name?.en;
    if (!name) continue;

    const lore = loreLookup.get(name.toLowerCase());
    if (!lore) continue;

    matched.add(name.toLowerCase());

    if (char.lore) {
      alreadyHadLore++;
      console.log(`  [skip] "${name}" already has lore`);
      continue;
    }

    await coll.updateOne(
      { _id: char._id },
      { $set: { lore } }
    );
    updated++;
    console.log(`  [updated] "${name}" (${char.faction})`);
  }

  // Report unmatched lore entries
  const unmatched = Object.keys(LORES).filter(
    (name) => !matched.has(name.toLowerCase())
  );

  console.log(`\n=== Summary ===`);
  console.log(`Characters updated with lore: ${updated}`);
  console.log(`Characters that already had lore: ${alreadyHadLore}`);
  console.log(`Total lore entries in script: ${Object.keys(LORES).length}`);
  if (unmatched.length > 0) {
    console.log(`\nLore entries that did NOT match any character:`);
    for (const name of unmatched) {
      console.log(`  - "${name}"`);
    }
  } else {
    console.log(`All ${Object.keys(LORES).length} lore entries matched a character!`);
  }

  await client.close();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
