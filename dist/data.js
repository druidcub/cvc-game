const FAMILIES = [
['at','a','bat cat hat mat rat pat fat flat sat','🐱'],
['ap','a','cap tap map flap rap lap nap gap trap snap','🧢'],
['ad','a','sad tad fad pad rad had lad mad bad dad','🙂'],
['am','a','ham bam pam jam ram cram clam Sam slam yam','🍓'],
['an','a','can tan fan pan ran van Dan man ban Stan','🥫'],
['ed','e','red bed led bled fed wed shed Ned sled shred','🖍️'],
['et','e','jet bet vet pet set met let get net yet','✈️'],
['en','e','ten Ben Jen when hen ren zen pen den Glen','🔟'],
['it','i','mitt bit pit lit sit kit wit nit fit hit','🧤'],
['in','i','fin bin pin grin sin tin chin kin win spin','🐟'],
['ig','i','pig wig twig dig fig big jig rig gig','🐷'],
['op','o','stop hop bop shop drop top flop mop glop cop','🛑'],
['og','o','frog bog log fog hog jog smog dog','🐸'],
['od','o','pod rod God cod sod nod','🫛'],
['ock','o','lock sock clock dock rock mock flock stock jock smock','🔒'],
['ug','u','bug lug plug pug rug mug dug tug hug','🐞'],
['un','u','run fun bun nun sun stun spun pun gun lunch','☀️'],
['ut','u','nut hut jut strut rut cut gut putt shut but','🌰'],
['us','u','bus Gus plus','🚌'],
['um','u','drum gum yum hum glum scum sum plum','🥁']
].map((f,i)=>({id:f[0],vowel:f[1],words:f[2].split(' '),emoji:f[3],page:i+1}));
const WORDS = FAMILIES.flatMap(f=>f.words.map(word=>({word,family:f.id,page:f.page,id:f.id+':'+word,emoji:f.emoji,special:['pam','ren','lunch'].includes(word)})));
