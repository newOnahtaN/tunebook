// Classify event venues into kinds by keyword.
export const VENUE_KINDS = [
  ['Pub or bar', /\b(pub|tavern|bar|saloon|inn|taproom|tap room|irish house|public house|alehouse|grill|lounge|shebeen|cottage|o'|mc[a-z]+'s|finnegan|murphy|kelly|flanagan|celt|harp|shamrock|claddagh|galway|dubliner|fadó|fado|burren|sl[aá]inte|whiske?y|irish haven|iona|mona's|rambling house|six penny|abbey|scholars|dubliner|paddy|molly|seisi[uú]n)\b/i],
  ['Brewery, winery or café', /\b(brew|brewing|brewery|winery|wine|cider|distill|coffee|café|cafe|espresso|tea ?house|bakery|beer garden)\b/i],
  ['Church or temple', /\b(church|chapel|cathedral|parish|lutheran|methodist|baptist|presbyterian|episcopal|unitarian|uu |quaker|friends meeting|meeting ?house|synagogue|temple|mosque|congregation|ministr|fellowship hall|st\. |saint |gurdwara|mission)\b/i],
  ['Senior or retirement center', /\b(senior|retire|55\+|active adult|leisure world|laguna woods|sun city|sun lakes|rv resort|mobile home|village clubhouse|the villages|elder)\b/i],
  ['School, college or library', /\b(school|college|university|campus|library|academy|conservatory|institute|uc |mit |harvard|tufts|stanford|berkeley|emory|rice univ)\b/i],
  ['Park or outdoors', /\b(park|plaza|square|garden|beach|pier|farm|ranch|outdoor|pavilion|lawn|street|alley|market|parking lot|fairground|zoo)\b/i],
  ['Folk venue, theatre or museum', /\b(theatre|theater|museum|jalopy|woodshed|music (store|center|shop|school)|guitar|fiddle ?shop|fiddlershop|violin|folklore center|folk school|old town school|swallow hill|freight|passim|mccabe|music hall|instrument|banjo|mandolin|acoustic)\b/i],
  ['Hall, lodge or community center', /\b(hall|lodge|center|centre|club|legion|vfw|grange|elks|moose|k of c|knights|sons of norway|turner|sokol|spjst|ballroom|community|rec(reation)?|ymca|jcc|cultural|society|association|armory|masonic|studio|dance spot|dancesport|ballet)\b/i],
  ['Restaurant', /\b(restaurant|pizza|kitchen|diner|bistro|cantina|taqueria|bbq|barbecue|steakhouse|eatery)\b/i],
  ['Private home', /\b(home|house concert|living room|private|residence|backyard)\b/i],
];
export function venueKind(e) {
  const v = `${e.venue || ''}`;
  for (const [k, re] of VENUE_KINDS) if (re.test(v)) return k;
  const n = `${e.name || ''} ${e.notes || ''}`.slice(0, 200);
  for (const [k, re] of VENUE_KINDS) if (re.test(n)) return k;
  return 'Unknown or varies';
}
