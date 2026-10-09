/* Deterministic scoring and transfer validation. No model or network dependencies. */
(function (root) {
  'use strict';
  const RULE_VERSION = '记者团修订版-2026-10-v1';
  const DEPARTMENTS=['主席团','运营部','北校摄影部','南校摄影部','国际摄影部','北校采编部','南校采编部','国际采编部','美编部','音视频部'];
  const departmentNames=state=>[...new Set([...DEPARTMENTS,...(state.roster||[]).map(m=>m.department)])];
  const restricted=state=>state.mode==='department'&&!!state.department;
  function scoreTargets(state,scope){return scope==='个人'?(state.roster||[]).filter(m=>m.active!=='离团'&&(!restricted(state)||m.department===state.department)).map(m=>({value:m.id,label:m.name+' / '+m.department+' · '+m.position})):departmentNames(state).filter(d=>!restricted(state)||d===state.department).map(d=>({value:d,label:d}));}
  const KINDS = ['现场活动','内容','绘图','主讲分享','跨部门培训','会议记录','缺席迟到','任务逾期','微博运营','自定义项目'];
  const RULE_ITEMS=[];
  function definition(id,scope,name,score,unit='分'){RULE_ITEMS.push({id,scope,name,score,unit,remarks:'',custom:false});}
  for(const [role,score] of [['部长',5],['副部长',5],['主管',3],['部员',0],['团长',null]])definition('p.role.'+role,'个人',role+'职务分',score);
  for(const [level,score] of [['部门',2],['团内',4],['校级',5]])definition('p.activity.'+level,'个人',level+'现场活动',score);
  definition('p.double','个人','校级活动双倍倍率',2,'倍');definition('p.double.points','个人','校级活动双倍绩效（仅现场活动）',10);
  definition('p.activity.运营部','个人','运营部门活动',6);
  for(const platform of ['官微','官方B站','官方视频号','国际官微','团微','团视频号'])definition('p.content.'+platform,'个人',platform+'已发布作品',platform.startsWith('团')?3:5);
  definition('p.unpublished.official','个人','官方作品未发出',3);definition('p.unpublished.club','个人','团平台作品未发出',2);
  definition('p.lead','个人','团平台作品负责人额外加分',2);
  definition('p.views.official','个人','官方浏览量奖励门槛',10000,'次');definition('p.views.club','个人','团平台浏览量奖励门槛',700,'次');definition('p.views.points','个人','每个浏览量门槛奖励',1);
  definition('p.views.official.points','个人','官方平台浏览量≥1万：参与者奖励',1);definition('p.views.club.points','个人','团平台浏览量≥700：参与者奖励',1);
  definition('p.art.base','个人','绘图每张',5);definition('p.art.extra','个人','单次绘图超过3张：超出部分每图额外奖励',1);definition('p.art.threshold','个人','单次绘图额外奖励门槛',3,'张');
  for(const [kind,score] of [['主讲分享',3],['跨部门培训',2],['会议记录',2],['任务逾期',-2]])definition('p.kind.'+kind,'个人',kind,score);
  for(const [role,score] of [['部长',-4],['副部长',-4],['主管',-2],['部员',-1],['团长',null]])definition('p.absence.'+role,'个人',role+'无故缺席迟到',score);
  definition('p.weibo.base','个人','微博月度运营基础',3);definition('p.weibo.threshold','个人','微博涨粉奖励门槛',1500,'人');definition('p.weibo.followers','个人','微博当月涨粉≥1500奖励',1);definition('p.weibo.hot','个人','微博登上热搜奖励',2);
  for(const platform of ['官微','官方视频号','团微','国际官微','官方B站','团视频号'])for(const role of ['参与','负责'])definition('d.content.'+platform+'.'+role,'部门',platform+'作品部门'+role,['国际官微','官方B站','团视频号'].includes(platform)?null:(platform==='团微'?3:5)+(role==='负责'?2:0));
  for(const [level,score] of [['部门',null],['团内',3],['校级',5]])definition('d.activity.'+level,'部门',level+'活动部门拍摄',score);
  for(const [p,n] of [['官微',3],['团微',5]]){definition('d.bonus.'+p+'.threshold','部门',p+'负责累计奖励门槛',n,'篇');definition('d.bonus.'+p+'.points','部门',p+'主要负责≥'+n+'篇：当月累计奖励',10);}
  for(const item of RULE_ITEMS){const id=item.id;item.remarks=id.startsWith('p.role.')?'职务分':id==='p.activity.运营部'?'运营部成员每月自动加分，依据成员名单计一次，无需活动记录':id.startsWith('p.activity.')?'活动分':id==='p.double.points'?'活动分翻倍，内容分不翻倍；同一工作取高一次':id.startsWith('p.absence.')||id==='p.kind.任务逾期'?'扣分':id==='p.kind.会议记录'?'选题会议不计分，会议记录每次计分':id.startsWith('p.kind.')?'活动分':id.startsWith('p.content.')?'内容分；同一作品按最高平台计一次，官方平台除官博':id==='p.lead'?'团平台作品负责人另加，内容分':id.startsWith('p.views.')?'内容分；所有参与者奖励，仅计明确的首个门槛':id.startsWith('p.weibo.')?'内容分；运营基础、涨粉和热搜分别计分':id.startsWith('p.unpublished.')?'内容分，未发出同样计分':id.startsWith('p.art.')?'内容分，无论是否发布；超3张部分每图叠加':id.startsWith('d.content.')?(id.includes('官方视频号')?'—':'同一部门单篇只加一次'):id.startsWith('d.activity.')?'—':id.startsWith('d.bonus.')?'当月累计奖励各计一次':'';}
  function ruleItems(rules={}){const removed=new Set(rules.deletedRuleIds||[]),stored=new Map((rules.items||[]).map(x=>[x.id,x]));return [...RULE_ITEMS.map(x=>({...x,...stored.get(x.id),custom:false})),...(rules.items||[]).filter(x=>x.custom&&!RULE_ITEMS.some(d=>d.id===x.id))].filter(x=>!removed.has(x.id));}
  definition('p.manual','个人','手动加分',null);RULE_ITEMS.at(-1).variable=true;RULE_ITEMS.at(-1).remarks='每次加分时自行填写分值';
  const PERSONAL_PROJECT_NAMES=['官微','官微1w+浏览','团微','团微700+浏览','负责人','校级活动','团内活动','部门活动','基础职务','微博组','视频组','小红书','其他内容'];
  function defaultProject(id){if(id.startsWith('p.role.'))return '基础职务';if(id==='p.activity.校级'||id==='p.double.points')return '校级活动';if(id==='p.activity.团内'||['p.kind.主讲分享','p.kind.跨部门培训','p.kind.会议记录'].includes(id))return '团内活动';if(id.startsWith('p.activity.'))return '部门活动';if(id==='p.lead')return '负责人';if(id==='p.views.official.points')return '官微1w+浏览';if(id==='p.views.club.points')return '团微700+浏览';if(id.startsWith('p.weibo.'))return '微博组';if(['p.content.官微','p.content.国际官微','p.unpublished.official'].includes(id))return '官微';if(['p.content.团微','p.unpublished.club'].includes(id))return '团微';if(['p.content.官方B站','p.content.官方视频号','p.content.团视频号'].includes(id))return '视频组';return '其他内容';}
  function personalProjects(rules={}){const stored=rules.bonusProjects||[],removed=new Set(rules.deletedProjectIds||[]),projects=PERSONAL_PROJECT_NAMES.filter(name=>name==='其他内容'||!removed.has('bonus.'+name)).map(name=>{const id='bonus.'+name,old=stored.find(p=>p.id===id);return {id,name:name==='其他内容'&&(!old?.name||old.name==='其他内容')?'其它内容':old?.name||name,ruleIds:[...(old?.ruleIds||[])]};});for(const p of stored)if(!removed.has(p.id)&&!projects.some(x=>x.id===p.id))projects.push({id:p.id,name:p.name,ruleIds:[...p.ruleIds]});const used=new Set(projects.flatMap(p=>p.ruleIds));for(const item of ruleItems(rules).filter(x=>x.scope==='个人'&&x.unit==='分'&&(x.score!==null||x.variable)&&!['p.role.部员','p.views.points'].includes(x.id)&&(!RULE_ITEMS.find(r=>r.id===x.id)||(RULE_ITEMS.find(r=>r.id===x.id).score!==null||x.variable)))){if(used.has(item.id))continue;(projects.find(p=>p.id==='bonus.'+defaultProject(item.id))||projects.find(p=>p.id==='bonus.其他内容')).ruleIds.push(item.id);}return projects;}
  function validateRules(rules){for(const key of ['deletedRuleIds','deletedProjectIds'])if(rules[key]!==undefined&&(!Array.isArray(rules[key])||rules[key].some(x=>typeof x!=='string')))throw Error('删除规则或项目的记录格式不正确');const items=ruleItems(rules),ids=new Set();for(const item of items){if(!item.id||ids.has(item.id)||!item.name?.trim()||!['个人','部门'].includes(item.scope)||!(item.score===null||Number.isFinite(item.score)))throw Error('规则项目、范围或分值不正确');if(item.unit!=='分'&&(!(item.score>0)||!Number.isInteger(item.score)))throw Error('奖励门槛与倍率必须为正整数');ids.add(item.id);}if(rules.bonusProjects!==undefined){if(!Array.isArray(rules.bonusProjects))throw Error('加分项目格式不正确');const projects=new Set(),owned=new Set();for(const p of rules.bonusProjects){if(!p.id||projects.has(p.id)||!p.name?.trim()||!Array.isArray(p.ruleIds))throw Error('加分项目名称或关联规则不正确');projects.add(p.id);for(const id of p.ruleIds){const item=items.find(x=>x.id===id);if(!item||item.scope!=='个人'||item.unit!=='分'||owned.has(id))throw Error('每条个人规则只能归属一个加分项目');owned.add(id);}}}return items;}
  const PLATFORMS = ['官微','官方B站','官方视频号','国际官微','团微','团视频号'];
  const official = p => ['官微','官方B站','官方视频号','国际官微'].includes(p);
  const club = p => ['团微','团视频号'].includes(p);
  const clone = x => JSON.parse(JSON.stringify(x));
  const split = x => Array.isArray(x) ? x : String(x || '').split(/[、,，;；\n]/).map(t=>t.trim()).filter(Boolean);
  function stable(x) { if (Array.isArray(x)) return '['+x.map(stable).join(',')+']'; if (x && typeof x==='object') return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}'; return JSON.stringify(x); }
  function hash(s) { let h=2166136261; for (const c of String(s)) { h^=c.charCodeAt(0); h=Math.imul(h,16777619); } return (h>>>0).toString(16); }
  const uid = () => typeof crypto!=='undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  function link(x) { try {const u=new URL(x); if(!['http:','https:'].includes(u.protocol))return '';u.hash=''; for(const k of ['utm_source','utm_medium','utm_campaign','from','isappinstalled'])u.searchParams.delete(k);u.searchParams.sort();return u.href;}catch{return '';}}
  const work = r => r._workKey || (r.workId ? '作品:'+r.workId : link(r.link) ? '链接:'+link(r.link) : '');
  const activity = r => r.activityId ? '活动:'+r.activityId : '';
  function empty(month='2026-09') { return {schema:1,month,ruleVersion:RULE_VERSION,rosterVersion:'名单-v1',roster:[],records:[],adjustments:[],decisions:{},tasks:[],submissions:{},history:[],audit:[],raw:[],overrides:{},adjustmentOverrides:{},rules:{views:'待确认',art:'待确认',bonusConfirmed:false},mode:'department',department:'',submitter:'',revision:0}; }
  function matchMember(value, roster, department='') {
    const s=String(value||'').trim();
    const exact=roster.filter(m=>m.id===s); if(exact.length===1)return exact[0];
    const candidates=roster.filter(m=>m.name===s||split(m.aliases).includes(s));
    if(candidates.length===1)return candidates[0];
    const narrowed=candidates.filter(m=>m.department===department);return narrowed.length===1?narrowed[0]:null;
  }
  function normalize(input, roster) {
    const r={...input}; r.id=r.id||uid();
    for(const k of ['memberId','name','department','kind','title','date','activityId','workId','platform','level','role','status','link','note','deptLead','batchId','ruleId','scoreScope','targetDepartment'])r[k]=String(r[k]??'').trim();
    const m=r.scoreScope==='部门'?null:matchMember(r.memberId||r.name,roster,r.department); if(m){r.memberId=m.id;r.name=m.name;r.department=m.department;}
    r.deptParticipants=split(r.deptParticipants);r.double=r.double===true||['是','双倍','2','true'].includes(String(r.double));
    for(const k of ['views','images','followers','hotSearch'])r[k]=r[k]===''||r[k]===null||r[k]===undefined?null:Number(r[k]);
    r.sources=Array.isArray(r.sources)?r.sources:[];return r;
  }
  function compute(state) {
    if(state.transferRules && Object.keys(state.transferRules).length){
      const base=compute({...state,transferRules:{}});
      for(const [key,rules] of Object.entries(state.transferRules)){const [scope,department]=key.split("|");const calc=compute({...state,rules,transferRules:{}}),ids=new Set(state.roster.filter(m=>m.department===department).map(m=>m.id));if(scope==="个人")base.personal=[...base.personal.filter(l=>!ids.has(l.target)),...calc.personal.filter(l=>ids.has(l.target))];else base.departments=[...base.departments.filter(l=>l.target!==department),...calc.departments.filter(l=>l.target===department)];}
      for(const m of base.totals)m.score=base.personal.filter(l=>l.target===m.id).reduce((n,l)=>n+l.score,0);for(const d of base.deptTotals)d.score=base.departments.filter(l=>l.target===d.department).reduce((n,l)=>n+l.score,0);return base;
    }
    const catalog=validateRules(state.rules),rulesById=new Map(catalog.map(x=>[x.id,x]));
    const missingRules=new Set();const q=id=>{if(state.rules.deletedRuleIds?.includes(id))return 0;const value=state.rules.definiteOnly&&RULE_ITEMS.find(x=>x.id===id)?.score===null?null:rulesById.get(id)?.score??null;if(value===null&&!state.rules.definiteOnly)missingRules.add(id);return value;},n=id=>rulesById.get(id)?.name||RULE_ITEMS.find(x=>x.id===id)?.name||'已删除规则';
    const issues=[], personal=[], departments=[]; const seenIssues=new Set();
    function issue(code,key,message,recordIds=[],hard=false) { if(state.rules.definiteOnly&&['团长职务口径','职务分口径','团长扣分口径','缺席扣分口径','内容分口径','部门活动口径','国际官微部门分','部门平台口径','规则未配置','浏览量阶梯','微博阶梯','微博热搜次数','累计奖励口径'].includes(code))return;const id=code+':'+key;if(seenIssues.has(id))return;seenIssues.add(id); const decision=state.decisions?.[id];issues.push({id,code,message,recordIds,hard,resolved:!hard&&!!decision?.reason,reason:decision?.reason||''}); }
    function add(target,id,personOrDept,score,explanation,records=[],ruleIds=[],parts=null) { if(!id.endsWith(":职务")&&state.removedPerformanceLines?.[id]?.month===state.month)return; target.push({id,target:personOrDept,score,explanation,ruleIds,parts:parts||[{ruleId:ruleIds[0]||"",score}],recordIds:[...new Set(records.flatMap(r=>r._recordIds||[r.id]))],sources:records.flatMap(r=>r.sources||[])}); }
    for(const f of state.raw||[])if(f.unrecognized)issue('原表未识别',f.digest,'表格未识别出可用表头，请手动登记并确认已处理：'+f.name);
    const roster=state.roster||[], people=new Map(roster.map(m=>[m.id,m]));
    const active=roster.filter(m=>m.active!=='离团');
    const expected=!restricted(state)?active:active.filter(m=>m.department===state.department);
    const rosterIds=new Set();for(const m of roster){if(!m.id||!m.name||!m.department)issue('名单缺失',m.id||m.name,'名单中的成员必须具有编号、姓名和部门',[],true);if(rosterIds.has(m.id))issue('成员编号重复',m.id,'成员编号重复：'+m.id,[],true);rosterIds.add(m.id);if(!['部长','副部长','主管','干事','部员','团长'].includes(m.position))issue('职务不明',m.id,m.name+'的职务尚未确认',[],true);}
    const records=[], recordIds=new Set();
    for(const raw of state.records||[]) {
      const r=normalize(raw,roster), m=people.get(r.memberId);delete r._workKey;let valid=true;
      function invalid(code,msg) {issue(code,r.id,msg,[r.id],true);valid=false;}
      if(recordIds.has(r.id)){invalid('明细编号重复','明细编号重复，请重新分配记录编号');continue;}recordIds.add(r.id);
      if(r.scoreScope&&!['个人','部门'].includes(r.scoreScope))invalid('计分范围错误','请选择个人或部门');
      if(r.scoreScope==='部门'){if(!departmentNames(state).includes(r.targetDepartment))invalid('部门不明','部门未列入名单');if(restricted(state)&&r.targetDepartment!==state.department)invalid('超出部门','只能提交本部门记录');if(r.memberId||r.name)invalid('部门身份错误','部门加分不指定个人');}
      else if(!m)invalid('成员待匹配',(r.name||r.memberId||'未填写成员')+'尚未匹配到名单');
      else if(m?.active==='离团')invalid('离团成员归属','离团成员仍有本月工作，请负责人确认名单状态后重新下发');
      else if(restricted(state)&&m&&m.department!==state.department)invalid('超出部门','部门只能提交本部门成员的个人明细');
      if(r.kind==='自定义项目'&&state.rules.deletedRuleIds?.includes(r.ruleId))continue;
      if(!KINDS.includes(r.kind))invalid('类型待确认','请选择有效的工作类型');
      if(r.kind==='自定义项目'&&(!rulesById.get(r.ruleId)?.custom||!r.activityId))invalid('自定义项目无效','选择统一规则中的自定义项目并填写事项编号');
      if(r.scoreScope&&r.kind==='自定义项目'&&rulesById.get(r.ruleId)?.scope!==r.scoreScope)invalid('计分范围错误','自定义规则与加分对象范围不一致');
      if(!r.title)invalid('标题缺失','请填写活动或作品标题');
      if(r.accountingMonth&&['个人','部门'].includes(r.scoreScope)){if(r.accountingMonth!==state.month)invalid('统计月份错误','加分记录不属于当前统计月份');}
      else {
      if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||Number.isNaN(Date.parse(r.date))||new Date(r.date+'T00:00:00Z').toISOString().slice(0,10)!==r.date)invalid('日期缺失','请填写真实的 YYYY-MM-DD 日期');
      else if(r.date.slice(0,7)!==state.month&&state.rules.definiteOnly)valid=false;
      else if(r.date.slice(0,7)!==state.month)issue('跨月归属',r.id,r.title+'的日期不属于当前月份，请确认归属或修正日期',[r.id]);
      }
      if(['内容','绘图'].includes(r.kind)&&!work(r))invalid('作品标识缺失','作品必须填写共享作品编号或有效发布链接');
      if(r.kind==='现场活动'&&!activity(r))invalid('活动标识缺失','现场活动必须填写共享活动编号');
      if(['现场活动','主讲分享','跨部门培训','会议记录','缺席迟到','任务逾期','微博运营'].includes(r.kind)&&!r.activityId)invalid('事项标识缺失','请填写活动/事项编号，用于防止重复计分');
      if(r.kind==='现场活动'&&!['部门','团内','校级'].includes(r.level))invalid('活动级别不明','现场活动必须填写部门、团内或校级');
      if(r.double&&r.level!=='校级')invalid('双倍范围','只有校级现场活动可以启用双倍');
      if(r.kind==='内容'&&!['已发布','未发出'].includes(r.status))invalid('发布状态不明','内容必须注明已发布或未发出');
      if(r.kind==='内容'&&!PLATFORMS.includes(r.platform))invalid('平台不明','此平台尚无确定计分规则，请选择规则中的平台或通过人工调整登记');
      if(['内容','绘图'].includes(r.kind)&&!['参与','负责'].includes(r.role))invalid('角色不明','请确认参与或负责');
      for(const k of ['views','images','followers','hotSearch'])if(r[k]!==null&&(!Number.isInteger(r[k])||r[k]<0))invalid('数值错误',k+'必须为非负整数');
      if(r.kind==='绘图'&&(!(r.images>0)||!r.batchId))invalid('绘图资料不全','绘图必须填写张数和单次绘图批次编号');
      const knownDeps=new Set(departmentNames(state));for(const dep of [...r.deptParticipants,r.deptLead].filter(Boolean))if(!knownDeps.has(dep))invalid('部门不明','部门不在统一名单内：'+dep);
      if(valid)records.push(r);
    }
    // Union shared IDs and exact publication links. Same link wins even if IDs differ.
    const parents=new Map();const find=k=>{if(!parents.has(k))parents.set(k,k);if(parents.get(k)!==k)parents.set(k,find(parents.get(k)));return parents.get(k);};
    for(const r of records.filter(r=>['内容','绘图'].includes(r.kind))){const a=r.workId?'作品:'+r.workId:'',b=link(r.link)?'链接:'+link(r.link):'';if(a)find(a);if(b)find(b);if(a&&b){const aa=find(a),bb=find(b);if(aa!==bb)parents.set(bb,aa);}}
    const components=new Map();for(const k of parents.keys()){const f=find(k);if(!components.has(f))components.set(f,[]);components.get(f).push(k);}
    const canonical=new Map([...components].map(([k,values])=>[k,values.sort()[0]]));
    for(const r of records.filter(r=>['内容','绘图'].includes(r.kind)))r._workKey=canonical.get(find(r.workId?'作品:'+r.workId:'链接:'+link(r.link)));
    const groups=new Map();for(const r of records){const key=(r.scoreScope==='部门'?'部门:'+r.targetDepartment:r.memberId)+'|'+r.kind+'|'+(['内容','绘图'].includes(r.kind)?work(r):r.kind==='自定义项目'?r.ruleId+'|'+activity(r):activity(r));if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
    const unique=[];
    for(const [key,rs] of groups){
      const signatures=new Map();for(const r of rs){const sig=stable(Object.fromEntries(['date','activityId','platform','level','role','status','views','images','double','batchId','followers','hotSearch'].map(k=>[k,r[k]])));if(!signatures.has(sig))signatures.set(sig,{...r,_recordIds:[r.id],sources:[...r.sources]});else {signatures.get(sig).sources.push(...r.sources);signatures.get(sig)._recordIds.push(r.id);}}
      const variants=[...signatures.values()];
      if(variants.length>1){const comparable=variants.map(r=>stable(Object.fromEntries(['date','activityId','level','images','double','batchId','followers','hotSearch'].map(k=>[k,r[k]]))));const platformVariants=new Map();for(const v of variants){const k=v.platform+'|'+v.status;if(!platformVariants.has(k))platformVariants.set(k,new Set());platformVariants.get(k).add(stable([v.role,v.views]));}if(new Set(comparable).size>1||[...platformVariants.values()].some(s=>s.size>1))issue('重复记录冲突',hash(key+stable(variants.map(v=>[v.role,v.views,...comparable]))), '同一成员同一工作出现日期、关联、角色或数量冲突，请修正：'+rs[0].title,rs.map(r=>r.id),true);}
      unique.push(...variants);
    }
    // Similar names are suggestions, never automatic identity merges.
    const similarities=new Map();for(const r of records.filter(r=>['内容','现场活动','绘图'].includes(r.kind))){const k=r.kind+'|'+r.title.replace(/\s/g,'')+'|'+r.date; if(!similarities.has(k))similarities.set(k,[]);similarities.get(k).push(r);}
    for(const [k,rs] of similarities)if(new Set(rs.map(r=>work(r)||activity(r))).size>1)issue('疑似重复',hash(k+rs.map(r=>r.id).sort().join(',')),'标题和日期相同但工作编号不同，请确认是否为同一工作：'+rs[0].title,rs.map(r=>r.id));
    const byMember=new Map();for(const r of unique.filter(r=>r.scoreScope!=='部门')){if(!byMember.has(r.memberId))byMember.set(r.memberId,[]);byMember.get(r.memberId).push(r);}
    for(const m of expected){
      const role=m.position==='干事'?'部员':m.position,rolePoints=q('p.role.'+role);if(rolePoints===null)issue(role==='团长'?'团长职务口径':'职务分口径',m.id,n('p.role.'+role)+'未设置分值，请确认规则');else if(rolePoints!==0)add(personal,'p:'+m.id+':职务',m.id,rolePoints,n('p.role.'+role)+'：'+rolePoints+' 分（依据 '+state.month+' 成员名单中 '+m.name+' 的'+m.position+'职务，每月计一次）',[],['p.role.'+role]);
      if(m.department==='运营部'){const points=q('p.activity.运营部')??0;if(points)add(personal,'p:'+m.id+':运营部月度',m.id,points,n('p.activity.运营部')+'：'+points+' 分（依据 '+state.month+' 成员名单中的运营部身份，每月自动计一次）',[],['p.activity.运营部']);}
      const rs=byMember.get(m.id)||[], works=new Map(), events=new Map();
      for(const r of rs){
        if(r.kind==='内容'){const k=work(r);if(!works.has(k))works.set(k,[]);works.get(k).push(r);}
        else if(r.kind==='现场活动'){const k=activity(r);if(!events.has(k))events.set(k,{activities:[],content:[]});events.get(k).activities.push(r);}
      }
      const contentScores=[];
      for(const [key,wrs] of works){
        const aids=new Set(wrs.map(activity).filter(Boolean));if(aids.size>1)issue('作品关联冲突',m.id+':'+hash(key),'同一作品关联多个活动，请统一关联',wrs.map(r=>r.id),true);
        const scored=wrs.map(r=>{const ruleId=r.status==='未发出'?'p.unpublished.'+(official(r.platform)?'official':'club'):'p.content.'+r.platform;const ruleIds=[ruleId],parts=[{ruleId,score:q(ruleId)??0}];let score=q(ruleId)??0;if(q(ruleId)===null)issue('内容分口径',r.id,n(ruleId)+'分值未设置',[r.id]);if(r.status==='已发布'&&club(r.platform)&&r.role==='负责'){score+=q('p.lead')??0;ruleIds.push('p.lead');parts.push({ruleId:'p.lead',score:q('p.lead')??0});}
          if(r.status==='已发布'&&r.views!==null){const threshold=q(official(r.platform)?'p.views.official':'p.views.club'),reward=q(state.rules.definiteOnly?(official(r.platform)?'p.views.official.points':'p.views.club.points'):'p.views.points')??0;if(r.views>=threshold){ruleIds.push(state.rules.definiteOnly?(official(r.platform)?'p.views.official.points':'p.views.club.points'):'p.views.points');score+=reward;parts.push({ruleId:ruleIds.at(-1),score:reward});if(!state.rules.definiteOnly&&state.rules.views==='阶梯'){const extra=(Math.floor(r.views/threshold)-1)*reward;score+=extra;parts.at(-1).score+=extra;}else if(state.rules.views!=='仅一次'&&r.views>=threshold*2)issue('浏览量阶梯',r.id,'浏览量达到多个门槛，需确认阶梯奖励口径',[r.id]);}}return {r,score,ruleId,ruleIds,parts};});
        scored.sort((a,b)=>(official(b.r.platform)?2:1)-(official(a.r.platform)?2:1)||(b.r.status==='已发布')-(a.r.status==='已发布')||b.score-a.score);
        const top=scored[0], aid=[...aids][0]||'';
        const item={id:'p:'+m.id+':'+key,score:top.score,parts:top.parts,ruleIds:top.ruleIds,rs:wrs,aid,explanation:top.r.title+'：'+n(top.ruleId)+' '+top.r.status+'，内容 '+top.score+' 分（同作品取最高平台）'};
        contentScores.push(item);
      }
      for(const item of contentScores){if(item.aid&&events.has(item.aid))events.get(item.aid).content.push(item);else add(personal,item.id,m.id,item.score,item.explanation,item.rs,item.ruleIds,item.parts);}
      for(const [key,e] of events){if(!e.content.length&&e.activities.every(r=>r.level==='部门'&&r.department==='运营部'))continue;const a=Math.max(...e.activities.map(r=>(r.double&&state.rules.definiteOnly?(q('p.double.points')??0):((r.level==='部门'&&r.department==='运营部'?0:q('p.activity.'+r.level))??0)*(r.double?q('p.double'):1)))),c=e.content.reduce((s,i)=>s+i.score,0),score=e.content.length?Math.max(a,c):a;add(personal,'p:'+m.id+':'+key,m.id,score,e.activities[0].title+'：活动 '+a+' 分；'+e.content.length+' 篇不同作品内容合计 '+c+' 分；'+(e.content.length?'取高 ':'活动计分 ')+score+' 分'+(e.content.length?'；作品细则：'+e.content.map(i=>i.explanation).join('；'):''),[...e.activities,...e.content.flatMap(i=>i.rs)],c>a?e.content.flatMap(i=>i.ruleIds):e.activities.filter(r=>(r.double&&state.rules.definiteOnly?q('p.double.points'):((r.level==='部门'&&r.department==='运营部'?0:q('p.activity.'+r.level))??0)*(r.double?q('p.double'):1))===a).map(r=>r.double&&state.rules.definiteOnly?'p.double.points':'p.activity.'+r.level),c>a?e.content.flatMap(i=>i.parts):null);}
      const otherGroups=new Map();for(const r of rs.filter(r=>!['内容','现场活动'].includes(r.kind))){const k=r.kind==='绘图'?'绘图:'+r.batchId:r.kind+':'+(r.ruleId||'')+':'+activity(r);if(!otherGroups.has(k))otherGroups.set(k,[]);otherGroups.get(k).push(r);}
      for(const [key,ors] of otherGroups){const r=ors[0];let score=0,explanation='',ruleIds=[],parts=null;
        if(r.kind==='绘图'){const uniqueArt=new Map();for(const a of ors)uniqueArt.set(work(a),a);const count=[...uniqueArt.values()].reduce((s,a)=>s+a.images,0);ruleIds=['p.art.base',...(count>q('p.art.threshold')?['p.art.extra']:[])];score=count*(q('p.art.base')??0)+Math.max(0,count-q('p.art.threshold'))*(q('p.art.extra')??0);parts=[{ruleId:'p.art.base',score:count*(q('p.art.base')??0)},{ruleId:'p.art.extra',score:Math.max(0,count-q('p.art.threshold'))*(q('p.art.extra')??0)}];explanation='绘图 '+count+' 张：每图 '+q('p.art.base')+' 分，超过 '+q('p.art.threshold')+' 张部分每图另加 '+q('p.art.extra')+' 分';const overlaps=ors.some(a=>works.has(work(a))||[...events.values()].some(e=>e.activities.some(ar=>activity(ar)===activity(a)&&activity(a))));if(overlaps&&state.rules.definiteOnly)continue;if(overlaps&&state.rules.art!=='叠加')issue('绘图叠加',r.id,'绘图与内容/活动存在同一工作关联，需人工确认是否重复计分',ors.map(a=>a.id));}
        else if(['主讲分享','跨部门培训','会议记录'].includes(r.kind)){score=q('p.kind.'+r.kind)??0;explanation=n('p.kind.'+r.kind)+' '+score+' 分';}
        else if(r.kind==='缺席迟到'){score=q('p.absence.'+role)??0;if(q('p.absence.'+role)===null)issue(role==='团长'?'团长扣分口径':'缺席扣分口径',r.id,n('p.absence.'+role)+'分值未设置',[r.id]);explanation=n('p.absence.'+role)+' '+score+' 分';}
        else if(r.kind==='任务逾期'){score=q('p.kind.任务逾期')??0;explanation=n('p.kind.任务逾期')+' '+score+' 分';}
        else if(r.kind==='微博运营'){score=q('p.weibo.base')??0;parts=[{ruleId:'p.weibo.base',score}];explanation='微博运营当月基础 '+score+' 分';if(r.followers>=q('p.weibo.threshold')){score+=q('p.weibo.followers')??0;parts.push({ruleId:'p.weibo.followers',score:q('p.weibo.followers')??0});explanation+='；涨粉达到 '+q('p.weibo.threshold')+' 奖励 '+q('p.weibo.followers')+' 分';if(r.followers>=q('p.weibo.threshold')*2)issue('微博阶梯',r.id,'微博涨粉多个门槛的奖励待确认',[r.id]);}if(r.hotSearch>0){score+=q('p.weibo.hot')??0;parts.push({ruleId:'p.weibo.hot',score:q('p.weibo.hot')??0});explanation+='；热搜 '+q('p.weibo.hot')+' 分';if(r.hotSearch>1)issue('微博热搜次数',r.id,'多次热搜是否累计需确认',[r.id]);}}
        if(r.kind==='自定义项目'){const item=rulesById.get(r.ruleId);if(item.scope!=='个人')continue;score=item.score??0;explanation=item.name+' '+score+' 分';if(item.score===null)issue('自定义分值',r.id,'自定义项目未设置分值',[r.id]);}add(personal,'p:'+m.id+':'+key,m.id,score,r.title+'：'+explanation,ors,r.kind==='自定义项目'?[r.ruleId]:r.kind==='绘图'?ruleIds:r.kind==='缺席迟到'?['p.absence.'+role]:r.kind==='微博运营'?['p.weibo.base',...(r.followers>=q('p.weibo.threshold')?['p.weibo.followers']:[]),...(r.hotSearch>0?['p.weibo.hot']:[])]:['p.kind.'+r.kind],parts);
      }
      const weibos=personal.filter(x=>x.target===m.id&&x.explanation.includes('微博运营当月'));if(weibos.length>1)issue('微博月度重复',m.id,'同一成员微博月度基础分登记多次，请合并成一个月度运营事项',weibos.flatMap(x=>x.recordIds),true);
    }
    // Department scores are independent from individual totals.
    const claims=new Map();for(const r of records.filter(r=>r.scoreScope!=='个人')){const deps=new Set((r.scoreScope==='部门'?[r.targetDepartment]:[...r.deptParticipants,r.deptLead,people.get(r.memberId)?.department]).filter(Boolean));for(const dep of deps){if(restricted(state)&&dep!==state.department)continue;const kind=r.kind==='现场活动'?'活动':r.kind==='内容'&&r.status==='已发布'?'作品':'';if(!kind)continue;const k=dep+'|'+kind+'|'+(kind==='活动'?activity(r):work(r));if(!claims.has(k))claims.set(k,{dep,kind,rs:[]});claims.get(k).rs.push(r);}}
    const bonusCounts={};for(const [key,c] of claims){if(state.removedPerformanceLines?.['d:'+key]?.month===state.month)continue;const lead=c.rs.some(r=>r.deptLead===c.dep), r=c.rs[0];let score=0,label='',ruleIds=[];
      const leads=new Set(c.rs.map(r=>r.deptLead).filter(Boolean));if(leads.size>1)issue('负责部门冲突',hash(key),'同一作品有不同负责部门，请核对：'+r.title,c.rs.map(r=>r.id));
      if(c.kind==='活动'){score=q('d.activity.'+r.level)??0;label=n('d.activity.'+r.level);ruleIds=['d.activity.'+r.level];if(q('d.activity.'+r.level)===null)issue('部门活动口径',hash(key),label+'分值未设置',c.rs.map(r=>r.id));if(c.rs.some(x=>x.level!==r.level))issue('部门活动级别冲突',hash(key),'同活动的部门活动级别不一致',c.rs.map(x=>x.id),true);}
      else {const ps=new Set(c.rs.map(r=>r.platform));const p=ps.has('官微')?'官微':ps.has('官方视频号')?'官方视频号':ps.has('团微')?'团微':r.platform;
        const ruleId='d.content.'+p+'.'+(lead?'负责':'参与');if(q(ruleId)===null){issue(p==='国际官微'?'国际官微部门分':'部门平台口径',hash(key),n(ruleId)+'分值未设置',c.rs.map(r=>r.id));continue;}score=q(ruleId);ruleIds=[ruleId];label=n(ruleId)+'（同部门同作品一次）';
        if(lead&&['官微','团微'].includes(p)){bonusCounts[c.dep]??={官微:0,团微:0};bonusCounts[c.dep][p]++;}
        if(c.rs.some(x=>x.activityId)&&[...claims.values()].some(x=>x.dep===c.dep&&x.kind==='活动'&&x.rs.some(a=>c.rs.some(b=>b.activityId===a.activityId))))issue('部门活动内容重叠',hash(key),'部门同活动拍摄和内容分能否并计需确认：'+r.title,c.rs.map(r=>r.id));
      }
      if(score)add(departments,'d:'+key,c.dep,score,r.title+'：'+label+' '+score+' 分',c.rs,ruleIds);
    }
    for(const [dep,counts] of Object.entries(bonusCounts))for(const [p,n] of Object.entries(counts))if(n>=q('d.bonus.'+p+'.threshold')){const bonus=q('d.bonus.'+p+'.points')??0;add(departments,'d:'+dep+':累计:'+p,dep,bonus,n+' 篇；'+nRule(p)+' '+bonus+' 分',[],['d.bonus.'+p+'.points']);if(!state.rules.bonusConfirmed)issue('累计奖励口径',dep+':'+p,'确认 '+dep+' 的 '+p+' 累计奖励按月各一次');}
    function nRule(p){return n('d.bonus.'+p+'.points');}
    const customDept=new Map();for(const r of records.filter(r=>r.scoreScope!=='个人'&&r.kind==='自定义项目'&&rulesById.get(r.ruleId)?.scope==='部门'))for(const dep of new Set((r.scoreScope==='部门'?[r.targetDepartment]:[...r.deptParticipants,r.deptLead,people.get(r.memberId)?.department]).filter(Boolean))){if(restricted(state)&&dep!==state.department)continue;const key=dep+'|'+r.ruleId+'|'+activity(r);if(!customDept.has(key))customDept.set(key,{dep,rs:[]});customDept.get(key).rs.push(r);}for(const [key,item] of customDept){const r=item.rs[0],rule=rulesById.get(r.ruleId);if(rule.score===null)issue('自定义分值',key,'自定义部门项目未设置分值',item.rs.map(r=>r.id));add(departments,'d:custom:'+key,item.dep,rule.score??0,rule.name+'：'+(rule.score??0)+' 分',item.rs,[rule.id]);}
    const adjustedTargets=new Set();
    for(const a of state.adjustments||[]){const target=a.scope==='部门'?departments:personal;const manualRule=a.manualRuleId?rulesById.get(a.manualRuleId):null;if(a.manualRuleId&&state.rules.deletedRuleIds?.includes(a.manualRuleId))continue;if(a.manualRuleId&&(!manualRule||manualRule.scope!==a.scope||manualRule.unit!=='分'||(manualRule.score===null&&!manualRule.variable)||a.manualRuleId.startsWith('p.role.')||a.manualRuleId==='p.activity.运营部')){issue('手动加分规则无效',a.id,'请选择有效的手动加分规则',[],true);continue;}const targetExists=a.scope==='部门'?departmentNames(state).includes(a.target):people.has(a.target);
      if(!targetExists||!Number.isFinite(a.score)||!a.reason||!['额外调整','替代计分'].includes(a.type)){issue('调整资料不全',a.id,'人工调整缺少有效对象、分值、类型或理由',[],true);continue;}
      if(a.type==='替代计分'){const old=target.find(x=>x.id===a.replaceId&&x.target===a.target);if(!old||adjustedTargets.has(a.replaceId)){issue('替代目标无效',a.id,'替代计分目标不存在或已被另一调整替代',[],true);continue;}adjustedTargets.add(a.replaceId);old.originalScore=old.score;old.score=0;old.explanation+='；由人工调整 '+a.id+' 替代';}
      add(target,(a.scope==='部门'?'d:':'p:')+'adjust:'+a.id,a.target,manualRule&&!manualRule.variable?manualRule.score:a.score,(manualRule?manualRule.name:'人工'+a.type)+'：'+a.reason,[],manualRule?[manualRule.id]:[]);
    }
    if(state.mode==='summary')for(const task of state.tasks||[])if(!state.submissions?.[task.id])issue('部门未提交',task.id,task.department+'尚未提交本月交接包',[],true);
    for(const id of missingRules)issue('规则未配置',id,n(id)+'没有设置分值，请在规则中设置或明确确认计分处理');const totals=expected.map(m=>({id:m.id,name:m.name,department:m.department,position:m.position,score:personal.filter(x=>x.target===m.id).reduce((s,x)=>s+x.score,0)}));
    const depNames=[...new Set([...expected.map(m=>m.department),...departmentNames(state).filter(d=>!restricted(state)||d===state.department)])]; const deptTotals=depNames.map(department=>({department,score:departments.filter(x=>x.target===department).reduce((s,x)=>s+x.score,0)}));
    return {personal,departments,totals,deptTotals,issues,pending:issues.filter(i=>!i.resolved),recordCount:records.length};
  }
  function fixedRecord(r){return String(r.manualRuleId||r.ruleId||'').startsWith('p.role.')||(r.manualRuleId||r.ruleId)==='p.activity.运营部';}
  function departmentLocked(state,department){return !!department&&(state.records.some(r=>r.scoreScope==='部门'&&r.targetDepartment===department&&!fixedRecord(r))||state.adjustments.some(a=>a.scope==='部门'&&a.target===department&&!fixedRecord(a)));}
  function memberLocked(state,id){const member=state.roster.find(m=>m.id===id);return !!member&&(departmentLocked(state,member.department)||state.records.some(r=>r.scoreScope!=='部门'&&r.memberId===id&&!fixedRecord(r))||state.adjustments.some(a=>a.scope==='个人'&&a.target===id&&!fixedRecord(a)));}
  function deleteRecordData(state,recordIds,adjustmentIds=[]){const rs=new Set(recordIds),as=new Set(adjustmentIds);state.records=state.records.filter(r=>!rs.has(r.id));state.adjustments=state.adjustments.filter(a=>!as.has(a.id));for(const id of rs){if(Object.hasOwn(state.overrides||{},id))delete state.overrides[id];}for(const id of as){if(Object.hasOwn(state.adjustmentOverrides||{},id))delete state.adjustmentOverrides[id];}
    for(const [task,pkg] of Object.entries(state.submissions||{})){const trim=p=>{p.records=(p.records||[]).filter(r=>!rs.has(task+'/'+r.id));p.adjustments=(p.adjustments||[]).filter(a=>!as.has(task+'/'+a.id));};trim(pkg);for(const h of state.history||[])if(h.taskId===task&&h.previous)trim(h.previous);}
  }
  function removePerformanceLine(state,scope,target,id){
    const line=(scope==='个人'?compute(state).personal:compute(state).departments).find(l=>l.id===id&&l.target===target);
    if(!line)throw Error('这条加分记录已不存在');
    if(id.endsWith(':职务')||line.ruleIds.some(r=>r.startsWith('p.role.')))throw Error('职务分不能移除');
    const adjustment=state.adjustments.find(a=>id===(scope==='个人'?'p:':'d:')+'adjust:'+a.id);
    if(adjustment||line.recordIds.length){deleteRecordData(state,line.recordIds,adjustment?[adjustment.id]:[]);if(state.removedPerformanceLines)delete state.removedPerformanceLines[id];}
    else {state.removedPerformanceLines??={};state.removedPerformanceLines[id]={month:state.month,scope,target};}
    state.decisions={};return line;
  }
  function purgeRemovedRecords(state){for(const [id,x] of Object.entries({...state.removedPerformanceLines})){if(x.month!==state.month)continue;delete state.removedPerformanceLines[id];const line=(x.scope==='个人'?compute(state).personal:compute(state).departments).find(l=>l.id===id&&l.target===x.target);if(line?.recordIds.length)removePerformanceLine(state,x.scope,x.target,id);else state.removedPerformanceLines[id]=x;}}
  function validateState(s) {if(!s||s.schema!==1||!/^\d{4}-(0[1-9]|1[0-2])$/.test(s.month)||!Array.isArray(s.roster)||!Array.isArray(s.records)||!Array.isArray(s.adjustments)||!s.rules||!Array.isArray(s.tasks)||!Array.isArray(s.audit)||!Array.isArray(s.raw)||!Array.isArray(s.history)||!s.submissions||!s.decisions)throw Error('文件格式或月份不正确');if(s.ruleVersion!==RULE_VERSION)throw Error('此规则版本不受当前工具支持，请使用同一版本工具');if(!['待确认','仅一次','阶梯'].includes(s.rules.views)||!['待确认','叠加'].includes(s.rules.art)||typeof s.rules.bonusConfirmed!=='boolean'||!['department','summary'].includes(s.mode))throw Error('规则配置或入口不正确');validateRules(s.rules);for(const [key,rules] of Object.entries(s.transferRules||{})){if(!/^(个人|部门)\|.+$/.test(key))throw Error("导入规则范围不正确");validateRules(rules);}if(s.roster.length>10000||s.records.length>100000)throw Error('数据量超过工具限制');return s;}
  function acceptSubmission(state,pkg) {
    if(pkg.schema!==1||pkg.kind!=='submission')throw Error('这不是部门交接包');
    if(pkg.month!==state.month||pkg.ruleVersion!==state.ruleVersion||pkg.rosterVersion!==state.rosterVersion||stable(pkg.roster)!==stable(state.roster)||stable(pkg.rules)!==stable(state.rules))throw Error('月份、名单或规则配置不一致，请重新下发任务包并重算');
    const task=state.tasks.find(t=>t.id===pkg.taskId&&t.department===pkg.department);if(!task)throw Error('不属于本月已下发部门任务');
    if(!Number.isInteger(pkg.revision)||pkg.revision<1||!pkg.batchId||!Array.isArray(pkg.records)||!Array.isArray(pkg.adjustments)||!Array.isArray(pkg.raw)||!pkg.decisions||typeof pkg.decisions!=='object')throw Error('交接包数据不完整');
    for(const r of pkg.records)if(r.scoreScope==='部门'?(r.targetDepartment!==pkg.department||!!r.memberId||!!r.name):!state.roster.some(m=>m.id===r.memberId&&m.department===pkg.department))throw Error('交接包包含未匹配或其他部门的个人记录');
    for(const a of pkg.adjustments){if(!['个人','部门'].includes(a.scope))throw Error('调整范围无效');if(a.scope==='个人'&&!state.roster.some(m=>m.id===a.target&&m.department===pkg.department))throw Error('调整对象超出部门');if(a.scope==='部门'&&a.target!==pkg.department)throw Error('部门调整对象超出任务');}
    for(const [id,x] of Object.entries(pkg.removedPerformanceLines||{}))if(x.month!==pkg.month||!['个人','部门'].includes(x.scope)||id.endsWith(':职务')||(x.scope==='个人'?!state.roster.some(m=>m.id===x.target&&m.department===pkg.department):x.target!==pkg.department))throw Error('移除记录超出部门任务');
    const old=state.submissions[pkg.taskId];if(old?.batchId===pkg.batchId){if(stable(old)!==stable(pkg))throw Error('相同提交批次内容不同，请重新导出新批次');return {status:'重复包，已忽略'};}if(old&&pkg.revision<=old.revision)throw Error('这是旧版本，或修订版本冲突，请提高修订号重新提交');
    if(old)state.history.push({at:new Date().toISOString(),taskId:pkg.taskId,previous:clone(old)});
    for(const id of Object.keys(state.overrides||{}))if(id.startsWith(pkg.taskId+'/'))delete state.overrides[id];
    for(const id of Object.keys(state.adjustmentOverrides||{}))if(id.startsWith(pkg.taskId+'/'))delete state.adjustmentOverrides[id];
    state.submissions[pkg.taskId]=clone(pkg);rebuild(state);purgeRemovedRecords(state);state.decisions={};state.audit.push({at:new Date().toISOString(),action:'导入部门交接包',department:pkg.department,revision:pkg.revision});return {status:old?'已替换旧版本，并清除汇总问题确认以重新核对':'已导入'};
  }
  function rebuild(state) {
    const own=state.records.filter(r=>!r.submissionTask), ownAdjust=state.adjustments.filter(a=>!a.submissionTask), raws=state.raw.filter(r=>!r.submissionTask);
    for(const [taskId,pkg] of Object.entries(state.submissions)){for(const r of pkg.records)own.push({...clone(r),id:taskId+'/'+r.id,submissionTask:taskId});for(const a of pkg.adjustments)ownAdjust.push({...clone(a),id:taskId+'/'+a.id,status:a.directApplied?'已生效':'待确认',approvedBy:a.directApplied?a.approvedBy:'',approvedAt:a.directApplied?a.approvedAt:'',submissionTask:taskId});for(const f of pkg.raw)raws.push({...clone(f),submissionTask:taskId});}
    const removed=Object.fromEntries(Object.entries(state.removedPerformanceLines||{}).filter(([,x])=>!x.submissionTask));for(const [taskId,pkg] of Object.entries(state.submissions))for(const [id,x] of Object.entries(pkg.removedPerformanceLines||{}))if(!removed[id])removed[id]={...clone(x),submissionTask:taskId};state.removedPerformanceLines=removed;
    state.records=own.map(r=>Object.prototype.hasOwnProperty.call(state.overrides||{},r.id)?clone(state.overrides[r.id]):r).filter(Boolean);state.adjustments=ownAdjust.map(a=>Object.prototype.hasOwnProperty.call(state.adjustmentOverrides||{},a.id)?clone(state.adjustmentOverrides[a.id]):a).filter(Boolean).map(a=>a.submissionTask&&!a.directApplied?{...a,status:'待确认',approvedBy:'',approvedAt:''}:a);state.raw=raws;
  }
  const api={memberLocked,departmentLocked,purgeRemovedRecords,removePerformanceLine,DEPARTMENTS,departmentNames,restricted,scoreTargets,PERSONAL_PROJECT_NAMES,personalProjects,RULE_ITEMS,ruleItems,validateRules,RULE_VERSION,KINDS,PLATFORMS,official,club,clone,split,stable,hash,uid,work,activity,empty,matchMember,normalize,compute,validateState,acceptSubmission,rebuild};
  root.PerformanceEngine=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);


