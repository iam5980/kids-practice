"""Build words.js for HA_Shadowing from extracted official word lists."""
import re, json, os, sys
HERE=os.path.dirname(os.path.abspath(__file__))
SRC=os.path.join(HERE,'wordlists')
# Function words / too-simple items excluded from practice
STOP=set("""a an the i me my mine you your yours he him his she her hers it its we us our ours they them their theirs
am is are was were be been being do does did have has had
and or but so if of to in on at by for from with as than then
this that these those there here what who whom whose which where when why how
not no yes oh ok okay hi bye hello wow hooray
can could will would shall should may might must
one two three four five six seven eight nine ten
mr mrs ms miss""".split())
LEVELS=[
 ("劍橋英檢","starters","Pre A1 Starters","starters.txt",""),
 ("劍橋英檢","movers","A1 Movers","movers.txt","只列 Movers 新增的字，基礎字在 Starters"),
 ("劍橋英檢","flyers","A2 Flyers","flyers.txt","只列 Flyers 新增的字"),
 ("劍橋英檢","ket","A2 Key (KET)","ket.txt",""),
 ("劍橋英檢","pet","B1 Preliminary (PET)","pet.txt","只列 PET 新增的字，KET 以下的字請到前面等級練"),
 ("全民英檢","gept1","初級","gept_elementary_full.txt",""),
 ("全民英檢","gept2","中級","gept_intermediate_full.txt","只列中級新增的字，基礎字在初級"),
 ("全民英檢","gept3","中高級","gept_high_intermediate_full.txt","只列中高級新增的字"),
 ("大考中心 高中參考詞彙","ceec1","第 1 級","ceec_1.txt","學測、分科測驗參考字表（111 學年度起適用）"),
 ("大考中心 高中參考詞彙","ceec2","第 2 級","ceec_2.txt",""),
 ("大考中心 高中參考詞彙","ceec3","第 3 級","ceec_3.txt",""),
 ("大考中心 高中參考詞彙","ceec4","第 4 級","ceec_4.txt",""),
 ("大考中心 高中參考詞彙","ceec5","第 5 級","ceec_5.txt",""),
 ("大考中心 高中參考詞彙","ceec6","第 6 級","ceec_6.txt",""),
 ("學術字彙 AWL","awl1","Sublist 1","awl_1.txt","大學、托福、雅思常見學術字；Sublist 1 最常用"),
 ("學術字彙 AWL","awl2","Sublist 2","awl_2.txt",""),
 ("學術字彙 AWL","awl3","Sublist 3","awl_3.txt",""),
 ("學術字彙 AWL","awl4","Sublist 4","awl_4.txt",""),
 ("學術字彙 AWL","awl5","Sublist 5","awl_5.txt",""),
 ("學術字彙 AWL","awl6","Sublist 6","awl_6.txt",""),
 ("學術字彙 AWL","awl7","Sublist 7","awl_7.txt",""),
 ("學術字彙 AWL","awl8","Sublist 8","awl_8.txt",""),
 ("學術字彙 AWL","awl9","Sublist 9","awl_9.txt",""),
 ("學術字彙 AWL","awl10","Sublist 10","awl_10.txt",""),
 ("Oxford 5000（CEFR 分級）","oxa1","A1","oxford_a1.txt",""),
 ("Oxford 5000（CEFR 分級）","oxa2","A2","oxford_a2.txt",""),
 ("Oxford 5000（CEFR 分級）","oxb1","B1","oxford_b1.txt",""),
 ("Oxford 5000（CEFR 分級）","oxb2","B2","oxford_b2.txt","約等於劍橋 B2 First (FCE)／全民英檢中高級"),
 ("Oxford 5000（CEFR 分級）","oxc1","C1","oxford_c1.txt","約等於劍橋 C1 Advanced (CAE)"),
]
FIX={'focus (sth) on/upon sth/sb':'focus on','step over/in/on/out of (sth)':'step on','wetsuit/wet suit':'wetsuit','base on':'be based on'}
def variants(raw):
    raw=FIX.get(raw.strip(),raw)
    raw=re.sub(r'\b(sth|sb)\b','',raw)
    s=raw.strip().replace('’',"'").replace('‘',"'")
    if not s or s.startswith('(') : return []
    while re.search(r'\([^()]*\)',s) and re.search(r'\((?:US|UK)[^()]*\([^()]*\)[^()]*\)',s):
        s=re.sub(r'\(((?:US|UK)[^()]*)\([^()]*\)([^()]*)\)',r'(\1\2)',s)
    s=re.sub(r'\((?:US|UK)[^)]*\)','',s)               # drop "(US color)"
    s=re.sub(r'\((?:as in|e\.g\.|for|of|as)[^)]*\)','',s,flags=re.I)  # drop usage notes
    s=re.sub(r'\([^)]*\)', lambda m: m.group(0) if re.fullmatch(r'\((s|e|es|got|up|bear|computer)\)',m.group(0)) else '', s)
    s=re.sub(r'\s+',' ',s).strip(' ,;')
    out=[]
    s=re.sub(r'^suprising$','surprising',s); s=re.sub(r'^Arithmetic$','arithmetic',s)
    s=re.sub(r'[!?]+$','',s).strip()
    parts=[]
    for y in re.split(r',| / ',s):
        y=y.strip()
        if '/' in y and len(y.split())>1: y=re.sub(r"([A-Za-z'-]+)/[A-Za-z'-]+",r'\1',y)
        parts+= y.split('/') if '/' in y else [y]
    for part in parts:
        part=part.strip()
        part=re.sub(r'\((s|e|es)\)',r'\1',part)        # stair(s)->stairs, blond(e)->blonde
        part=re.sub(r'\s*\((got|up|bear|computer)\)',lambda m:' '+m.group(1) if m.group(1) in('up',) else '',part)  # wake (up)->wake up; have (got) to->have to
        part=re.sub(r'\s+',' ',part).strip()
        if part: out.append(part)
    return out
def key(w): return re.sub(r'[^a-zé]','',w.lower())
def is_name(w,raw):
    return bool(re.fullmatch(r'[A-Z][a-z]+',w)) and not re.fullmatch(r'(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December|English|Chinese|Christmas|Earth|London|America|American|Asia|Asian|Australia|Britain|Canada|China|Japan|Europe|Africa|Taiwan|Internet)',w)
YLE_NAMES={'yle'}
ZH={}
_g=json.load(open(os.path.join(HERE,'zh','gept_zh.json'),encoding='utf-8'))
for w,v in _g.items(): ZH.setdefault(w.lower(),v)
for f in ('missing_zh.json','missing_zh2.json','missing_zh3.json','missing_zh4.json'):
    for w,v in json.load(open(os.path.join(HERE,'zh',f),encoding='utf-8')).items(): ZH.setdefault(w.lower(),v)
ZH['focus on']='phr. 集中（注意力）於、聚焦於'; ZH['step on']='phr. 踩到、踏上'; ZH['be based on']='phr. 以……為根據'; ZH['wetsuit']='n. 潛水衣、防寒衣'
BR={'colour':'color','favourite':'favorite','centre':'center','theatre':'theater','programme':'program','jewellery':'jewelry','grey':'gray','metre':'meter','kilometre':'kilometer','practise':'practice','neighbour':'neighbor'}
def zh_of(w):
    k=w.lower()
    for c in [k,re.sub(r'is(e|ed|es|ing|ation)$',r'iz\1',k),k.replace('-',' '),k.replace(' ','-'),k.replace('-',''),re.sub(r'ies$','y',k),re.sub(r'es$','',k),re.sub(r's$','',k),BR.get(k,k)]:
        if c in ZH: return ZH[c]
    return ''
CEFR={'ceec1':'A1','ceec2':'A2','ceec3':'B1','ceec4':'B1','ceec5':'B2','ceec6':'B2',**{f'awl{i}':('B2' if i<=5 else 'C1') for i in range(1,11)},'starters':'Pre-A1','movers':'A1','flyers':'A2','ket':'A2','pet':'B1','gept1':'A2','gept2':'B1','gept3':'B2','oxa1':'A1','oxa2':'A2','oxb1':'B1','oxb2':'B2','oxc1':'C1'}
data=[];report=[]
seen_route={}
for route,id_,name,fn,note in LEVELS:
    path=os.path.join(SRC,fn)
    if not os.path.exists(path): report.append(f'{name}: MISSING'); continue
    raw=[l.rstrip('\n') for l in open(path,encoding='utf-8')]
    seen=seen_route.setdefault(route,set())
    words=[];drop_stop=drop_name=drop_dup=0
    for r in raw:
        for w in variants(r):
            k=key(w)
            if not k or len(k)<2: drop_stop+=1; continue
            if w.lower() in STOP or k in STOP or w in ('Dr','Dr.','Mr.','Mrs.','Ms.'): drop_stop+=1; continue
            if id_ in('starters','movers','flyers') and is_name(w,r): drop_name+=1; continue
            if k in seen: drop_dup+=1; continue
            seen.add(k); words.append(w)
    words.sort(key=lambda w:(w.lower().lstrip("'"),w))
    zhs=[zh_of(w) for w in words]
    data.append({"route":route,"id":id_,"name":name,"cefr":CEFR[id_],"note":note,"words":words,"zh":zhs})
    report.append(f"   zh missing: {sum(1 for z in zhs if not z)} {[w for w,z in zip(words,zhs) if not z][:8]}")
    report.append(f'{name}: raw {len(raw)} -> {len(words)} (stop {drop_stop}, names {drop_name}, dup {drop_dup})')
js="/* 單字題庫：劍橋英檢官方 Wordlist／Vocabulary List、LTTC 全民英檢參考字表、Oxford 5000（CEFR）。中文釋義取自 LTTC 字表，其餘為補充譯註。\n   同一路線內每個字只出現在最早的等級；已排除冠詞、代名詞、be 動詞等功能字與 YLE 人名。 */\nwindow.WORDBANK="+json.dumps(data,ensure_ascii=False,separators=(',',':'))+";\n"
open(sys.argv[1] if len(sys.argv)>1 else os.path.join(HERE,'..','words.js'),'w',encoding='utf-8').write(js)
print('\n'.join(report))
