// Shared vocabulary for the tune book, used by the main page (/fiddle) and the data gaps page (/fiddle/gaps).
// When a research run introduces a new tradition, tune type or style tag, add it here so the filters, the type
// legend and the gaps page all know about it.
(function(){
// Genre families: picking a parent genre in the filter also matches all its descendants. A genre can sit under
// more than one parent (Cape Breton is Scottish and Canadian); the first parent listed decides where it shows.
const GENRE_TREE = [
  ["Celtic", ["Irish", "Scottish", "Breton"]],
  ["Irish", ["Donegal", "Sliabh Luachra"]],
  ["Scottish", ["Shetland", "Orkney", "Cape Breton"]],
  ["English", ["Northumbrian"]],
  ["Canadian", ["Québécois", "Métis", "Canadian old-time", "PEI", "Newfoundland", "Cape Breton"]],
  ["Québécois", ["Gaspé"]],
  ["American", ["Old-time", "Bluegrass", "Contra", "Cajun", "Western swing", "Jazz"]],
  ["Old-time", ["Appalachian", "Kentucky", "North Carolina Piedmont", "Ozark", "Texas contest", "Black string band", "Minstrel", "Alabama", "Pacific Northwest"]],
  ["Appalachian", ["Round Peak", "Galax", "West Virginia"]],
  ["Nordic", ["Swedish", "Finnish", "Scandinavian"]],
];
const GENRE_ROOTS = ["Celtic", "English", "Canadian", "American", "Nordic", "Waltz", "Castilian", "Camp composition"];
// Plain-language definitions shown in the "Tune types" legend.
const TYPE_INFO = {
  reel: "The workhorse dance tune of Irish, Scottish, Cape Breton, Québécois and contra music: cut time (2/2 or 4/4), played fast in steady running eighth notes, usually two 8-bar parts, each repeated (AABB).",
  breakdown: "The old-time and bluegrass name for a fast dance tune in 2/4 or cut time, the American cousin of the reel. Driving, with a strong backbeat from the bow.",
  jig: "6/8 time, with the beat split into threes (\"diddle-dee, diddle-dee\"). Lilting rather than driving. The most common is the double jig; single jigs and slip jigs (9/8) are relatives.",
  "slip jig": "A jig in 9/8 time: three beats per bar, each divided into three. Its extra beat gives a longer, flowing step than a 6/8 jig; especially common in Irish music.",
  slide: "A fast 12/8 tune from the Sliabh Luachra area on the Kerry–Cork border, played for set dancing. Feels like a jig with a long-short bounce.",
  polka: "A quick, bouncy 2/4 tune in short phrases. In Irish music it's the signature of Sliabh Luachra; it's also a staple of contra and Scandinavian dances.",
  hornpipe: "4/4 with a dotted or swung rhythm, slower and heavier than a reel, and parts that often end on three strong \"stops\". Originally for step dancing.",
  barndance: "A relaxed 4/4 tune with a hornpipe-like swing, played for barn dances and \"germans\". Related to the schottische.",
  strathspey: "A Scottish dance tune in slow 4/4 packed with the \"Scotch snap\" (a short note before a long one) and dotted rhythms. Usually played before a reel in a set.",
  march: "A tune for marching, usually in 2/4, 4/4 or 6/8, with a steady, stately pulse.",
  "pipe march": "A march from the Highland bagpipe repertoire, played on fiddle. Expect big gracenote-style ornaments and a range that sits on the pipes' nine notes.",
  rag: "An old-time tune that borrows ragtime's syncopation and moving chords, often chromatic passing notes and circle-of-fifths progressions.",
  "two-step": "A 2/4 or 4/4 tune for the two-step couples dance, common in Métis, Canadian old-time and Cajun music.",
  waltz: "3/4 time, one strong beat per bar, for couples dancing. Played at anything from a slow ballad pace to a brisk turn.",
  "slow air": "A slow, free-time melody played expressively rather than for dancing, often from a song. The player shapes the rhythm like a singer.",
  "song tune": "An instrumental version of a song's melody. The words usually still exist and shape the phrasing.",
  jota: "A lively Spanish folk dance from Aragon and Castile in quick triple time (3/4 or 6/8), traditionally with castanets.",
  schottische: "A 4/4 couples dance tune with a dotted, skipping rhythm, slower than a reel. Common in Scandinavian, Scottish and old-time dances.",
};
// Style tags. Reuse these spellings; add new ones sparingly.
const TAGS = ["traditional", "modern composition", "crooked", "cross-tuned", "pipe tune", "modal", "three+ parts",
  "slow air", "has words", "descriptive piece", "fast showpiece", "session standard", "jam standard", "contra favorite",
  "square dance", "Scottish country dance", "ceilidh", "beginner friendly"];
window.TUNE_VOCAB = { GENRE_TREE, GENRE_ROOTS, TYPE_INFO, TAGS };
})();
