import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, serverTimestamp, Timestamp, query, orderBy, limit, runTransaction, writeBatch, deleteDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
const app=initializeApp({apiKey:'AIzaSyB2k_XUrY51_lCbtG-VJqH-ZgXpVtP68WU',authDomain:'futsaldouro-cc217.firebaseapp.com',projectId:'futsaldouro-cc217',storageBucket:'futsaldouro-cc217.firebasestorage.app',messagingSenderId:'350871531138',appId:'1:350871531138:web:25096ec08bca6da82a8e9b'});
const safePublicName = value => String(value || 'Participante').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, email => email.split('@')[0]);
const auth=getAuth(app), db=getFirestore(app), adminIds=['dFMaDaxMwSdhbRAVREytL40OnzP2','rVTyrFQWkuZ7ZoueMQclGJWREhr1'];
const login=document.querySelector('#login-google'), logout=document.querySelector('#logout-google'), name=document.querySelector('#auth-name');
const adminPage=location.pathname.endsWith('/admin.html'); const league=document.getElementById('liga'), grid=league.querySelector('.grid');
const ui=document.createElement('section');ui.className='card live-league';ui.style.marginTop='32px';ui.innerHTML='<div class="league-eyebrow">LIGA FD · PALPITES</div><h2>A jornada</h2><p id="league-status">A carregar jornada…</p><div id="live-games"></div><button id="send-live" class="cta" type="button" hidden>Enviar palpites</button><div id="manage" hidden><hr><h2>Área de organização</h2><p>Cria uma jornada de teste. O prazo é interpretado na hora do teu computador.</p><label>Nome da jornada <input id="round-title" value="Jornada de teste" maxlength="60"></label><div id="edit-games"></div><label>Prazo <input id="round-deadline" type="datetime-local"></label><p><button id="create-round" type="button">Criar jornada</button></p></div>';grid.before(ui);
let current=null, selected=Array(7).fill(null);
const status=document.getElementById('league-status'), games=document.getElementById('live-games'), send=document.getElementById('send-live'), manage=document.getElementById('manage');
const editor=document.getElementById('edit-games');for(let i=0;i<7;i++){const row=document.createElement('p');const field=document.createElement('input');field.placeholder=`Jogo ${i+1} (ex.: Equipa A × Equipa B)`;field.maxLength=100;field.className='game-input';field.style.cssText='width:100%;padding:10px';row.append(field);editor.append(row)}
function message(s){status.textContent=s}
const roundPicker=document.createElement('select');
roundPicker.id='round-picker';
roundPicker.setAttribute('aria-label','Escolher jornada');
roundPicker.style.cssText='max-width:100%;padding:10px;margin:8px 0 16px';
const roundLabel=document.createElement('label');
roundLabel.textContent='Escolher jornada ';
roundLabel.append(roundPicker);
status.before(roundLabel);
let chosenRound=null, refreshVersion=0;
roundPicker.onchange=()=>{chosenRound=roundPicker.value;current=null;send.hidden=true;games.replaceChildren();syncAdminRound();message('A carregar jornada…');refresh()};
async function refresh(){
  const version=++refreshVersion;
  try {
    const snapshot=await getDocs(query(collection(db,'rounds'),orderBy('deadline','desc')));
    if(version!==refreshVersion)return;
    roundPicker.replaceChildren();
    if(snapshot.empty){current=null;games.replaceChildren();send.hidden=true;roundLabel.hidden=true;message('Ainda não há jornadas criadas.');syncAdminRound();return}
    roundLabel.hidden=!adminPage;
    snapshot.docs.forEach(r=>{const o=document.createElement('option');o.value=r.id;o.textContent=r.data().title||'Jornada';roundPicker.append(o)});
    let r=snapshot.docs.find(x=>x.id===chosenRound)||snapshot.docs[0];
    chosenRound=r.id;roundPicker.value=r.id;
    const next={id:r.id,...r.data()};
    const submitted=auth.currentUser?(await getDoc(doc(db,'rounds',next.id,'predictions',auth.currentUser.uid))).exists():false;
    if(version!==refreshVersion)return;
    current=next;selected=Array(7).fill(null);games.replaceChildren();
    const closed=current.deadline.toMillis()<=Date.now();
    message(`${current.title} · Prazo: ${current.deadline.toDate().toLocaleString('pt-PT',{timeZone:'Europe/Lisbon'})} (Lisboa). ${submitted?'Já enviaste os teus palpites.':closed?'Prazo terminado.':'Escolhe 1, X ou 2 em cada jogo.'}`);
    current.games.forEach((game,i)=>{
      const row=document.createElement('div');row.className='row match-row';
      const choices=document.createElement('div');choices.className='choices';choices.setAttribute('role','group');choices.setAttribute('aria-label',game);
      const teams=game.split(/\s+(?:x|vs\.?|versus)\s+|\s*×\s*/i).map(t=>t.trim());
      const names=teams.length===2&&teams.every(Boolean)?[teams[0],'Empate',teams[1]]:['Casa','Empate','Fora'];
      ['1','X','2'].forEach((value,option)=>{const b=document.createElement('button');b.type='button';b.textContent=names[option];b.disabled=submitted||closed;b.onclick=()=>{selected[i]=value;choices.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b))};choices.append(b)});
      row.append(choices);games.append(row);
    });
    send.hidden=submitted||closed;send.textContent=auth.currentUser?'Enviar palpites':'Entra com Google para enviar';
    syncAdminRound();
  } catch(e){console.error(e);if(version===refreshVersion)message('Não foi possível carregar a jornada. Verifica a ligação e as regras do Firebase.')}
}

login.onclick=async()=>{try{await signInWithPopup(auth,new GoogleAuthProvider())}catch(e){if(e.code!=='auth/popup-closed-by-user')alert('Não foi possível entrar: '+e.code)}};logout.onclick=()=>signOut(auth);
onAuthStateChanged(auth,user=>{login.hidden=!!user;logout.hidden=!user;name.hidden=!user;name.textContent=user?.displayName||'';manage.hidden=!adminPage || !adminIds.includes(user?.uid);document.getElementById('admin-link').hidden=!adminIds.includes(user?.uid);refresh()});
send.onclick=async()=>{if(!auth.currentUser){alert('Entra primeiro com Google.');return}if(selected.some(x=>!x)){alert('Escolhe um palpite para cada jogo.');return}send.disabled=true;try{await setDoc(doc(db,'rounds',current.id,'predictions',auth.currentUser.uid),{answers:selected,createdAt:serverTimestamp(),displayName:safePublicName((await getDoc(doc(db,'profiles',auth.currentUser.uid))).data()?.displayName || auth.currentUser.displayName || 'Participante').slice(0,80)});alert('Palpites guardados!');await refresh()}catch(e){console.error(e);alert('Não foi possível guardar. Verifica se o prazo terminou ou se já enviaste palpites.')}finally{send.disabled=false}};
document.getElementById('create-round').onclick=async()=>{const title=document.getElementById('round-title').value.trim(), list=[...document.querySelectorAll('.game-input')].map(x=>x.value.trim()), date=new Date(document.getElementById('round-deadline').value);if(!title||list.some(x=>!x)||Number.isNaN(date.getTime())||date<=new Date()){alert('Preenche o nome, os sete jogos e um prazo futuro.');return}try{const newRound=doc(collection(db,'rounds'));await setDoc(newRound,{title,games:list,deadline:Timestamp.fromDate(date)});chosenRound=newRound.id;alert('Jornada criada.');await refresh()}catch(e){console.error(e);alert('Não foi possível criar a jornada. Verifica as regras e a tua conta de administrador.')}};

// Results and public leaderboards are published only by the administrator.
const rankings=document.createElement('section');rankings.className='card live-rankings';rankings.style.marginTop='24px';rankings.innerHTML='<div class="league-eyebrow">A CORRIDA AO TOPO</div><h2>Classificações</h2><div class="choices ranking-tabs"><button type="button" id="ranking-week">Semanal</button><button type="button" id="ranking-total">Geral</button></div><p id="ranking-caption"></p><div id="ranking-list"></div>';ui.after(rankings);if(!adminPage){const layout=document.createElement("div");layout.className="league-layout";ui.before(layout);layout.append(ui,rankings)}
const resultsPanel=document.createElement('div');resultsPanel.innerHTML='<hr><h2>Resultados da jornada atual</h2><p>Seleciona os sete resultados finais e publica as classificações.</p><div id="result-games"></div><button type="button" id="save-results">Guardar resultados e atualizar classificações</button>';manage.append(resultsPanel);
const resultChoices=Array(7).fill(null), resultGames=document.getElementById('result-games');
for(let i=0;i<7;i++){const row=document.createElement('div');row.className='row';const label=document.createElement('span');label.textContent='Jogo '+(i+1);const buttons=document.createElement('div');buttons.className='choices';['1','X','2'].forEach(v=>{const b=document.createElement('button');b.type='button';b.textContent=v;b.onclick=()=>{resultChoices[i]=v;buttons.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b))};buttons.append(b)});row.append(label,buttons);resultGames.append(row)}
const rankingList=document.getElementById('ranking-list'),rankingCaption=document.getElementById('ranking-caption');
async function showStandings(which){document.getElementById('ranking-week').classList.toggle('active',which==='weekly');document.getElementById('ranking-total').classList.toggle('active',which==='total');rankingList.replaceChildren();try{const snap=await getDoc(doc(db,'publicStandings',which));if(!snap.exists()){rankingCaption.textContent='Ainda não há classificação publicada.';return}const data=snap.data();rankingCaption.textContent=which==='weekly'?'Jornada: '+data.title:'Pontos acumulados nas jornadas corrigidas.';if(!data.rows.length){rankingCaption.textContent+=' Ainda não há palpites corrigidos.';return}data.rows.forEach((entry,i)=>{const row=document.createElement('div');row.className='row';const label=document.createElement('span');label.textContent=(i+1)+'.º · '+safePublicName(entry.name);const points=document.createElement('strong');points.textContent=entry.points+' pts';row.append(label,points);rankingList.append(row)})}catch(e){console.error(e);rankingCaption.textContent='Não foi possível carregar a classificação.'}}
document.getElementById('ranking-week').onclick=()=>showStandings('weekly');document.getElementById('ranking-total').onclick=()=>showStandings('total');
document.getElementById('save-results').onclick=async()=>{if(!adminIds.includes(auth.currentUser?.uid)||!current){alert('Entra como organizador e cria uma jornada.');return}if(resultChoices.some(x=>!x)){alert('Seleciona os sete resultados.');return}if(Date.now()<current.deadline.toMillis()){alert('Espera até ao fim do prazo da jornada para publicar resultados.');return}const button=document.getElementById('save-results');button.disabled=true;try{await setDoc(doc(db,'rounds',current.id),{results:resultChoices},{merge:true});const all=await getDocs(collection(db,'rounds'));const totals=new Map();let weekly=[];for(const round of all.docs){const data=round.data();if(!Array.isArray(data.results)||data.results.length!==7)continue;const entries=await getDocs(collection(db,'rounds',round.id,'predictions'));for(const entry of entries.docs){const p=entry.data();if(!Array.isArray(p.answers))continue;const score=p.answers.reduce((sum,answer,i)=>sum+(answer===data.results[i]?1:0),0);const person=totals.get(entry.id)||{uid:entry.id,name:safePublicName(p.displayName),points:0};person.name=safePublicName(p.displayName||person.name);person.points+=score;totals.set(entry.id,person);if(round.id===current.id)weekly.push({name:safePublicName(p.displayName),points:score})}}const sort=(a,b)=>b.points-a.points||a.name.localeCompare(b.name,'pt');weekly.sort(sort);const total=[...totals.values()].sort(sort);await setDoc(doc(db,'publicStandings','weekly'),{title:current.title,rows:weekly.map(x=>({...x,name:safePublicName(x.name)}))});await setDoc(doc(db,'publicStandings','round_'+current.id),{title:current.title,rows:weekly.map(x=>({...x,name:safePublicName(x.name)}))});await setDoc(doc(db,'publicStandings','total'),{rows:total.map(x=>({...x,name:safePublicName(x.name)}))});alert('Resultados guardados e classificações atualizadas.');await showStandings('weekly')}catch(e){console.error(e);alert('Não foi possível atualizar. Confirma que publicaste as regras mais recentes e tenta novamente.')}finally{button.disabled=false}};












// Perfis e pontos anteriores: os pedidos são aprovados pela organização.
const legacyBase = fetch('classificacao-base.json').then(r => {
  if (!r.ok) throw new Error('Não foi possível carregar a classificação anterior.');
  return r.json();
});
const oldShowStandings = showStandings;
showStandings = async function(which) {
  if (which !== 'total') return oldShowStandings(which);
  document.getElementById('ranking-week').classList.remove('active');
  document.getElementById('ranking-total').classList.add('active');
  rankingList.replaceChildren();
  rankingCaption.textContent = 'A carregar classificação geral…';
  try {
    const [base, claims, profiles, currentSnap] = await Promise.all([
      legacyBase, getDocs(collection(db,'legacyClaims')),
      getDocs(collection(db,'profiles')), getDoc(doc(db,'publicStandings','total'))
    ]);
    const byName = new Map(base.map(x => [x.name.toLowerCase(), {name:x.name,points:x.points}]));
    const claimByUser = new Map();
    claims.forEach(c => {const v=c.data(); if(v.uid && v.legacyName) claimByUser.set(v.uid,v.legacyName.toLowerCase())});
    const profileByUser = new Map();
    profiles.forEach(p => profileByUser.set(p.id,p.data().displayName));
    const extra = [];
    for (const row of (currentSnap.exists() ? currentSnap.data().rows || [] : [])) {
      const oldName = row.uid && claimByUser.get(row.uid);
      const baseRow = oldName && byName.get(oldName);
      if (baseRow) {
        baseRow.points += Number(row.points)||0;
        baseRow.name = profileByUser.get(row.uid) || row.name || baseRow.name;
      } else extra.push({name:profileByUser.get(row.uid)||row.name||'Participante',points:Number(row.points)||0});
    }
    // Um perfil aprovado também altera o nome antes de haver novas jornadas.
    claimByUser.forEach((name,uid)=>{const row=byName.get(name);if(row && profileByUser.get(uid))row.name=profileByUser.get(uid)});
    const rows=[...byName.values(),...extra].sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name,'pt'));
    rankingCaption.textContent='Pontos das primeiras jornadas e das jornadas corrigidas no site.';
    rows.forEach((entry,i)=>{const row=document.createElement('div');row.className='row';const label=document.createElement('span');label.textContent=(i+1)+'.º · '+safePublicName(entry.name);const points=document.createElement('strong');points.textContent=entry.points+' pts';row.append(label,points);rankingList.append(row)});
  } catch(e) {console.error(e);rankingCaption.textContent='Não foi possível carregar a classificação geral.'}
};

const profilePanel=document.createElement('section');
profilePanel.className='card';
profilePanel.style.marginTop='24px';
profilePanel.innerHTML='<h2>O meu perfil</h2><p>Entra com Google para escolher o nome que aparece na classificação e pedir os pontos das primeiras jornadas.</p><div id="profile-content" hidden><label>Nome na classificação <input id="profile-name" maxlength="80"></label><p><button type="button" id="profile-save">Guardar nome</button></p><hr><h2>Pontos anteriores</h2><p>Seleciona o nome que usaste antes. A organização confirma a associação.</p><label>Nome anterior <select id="profile-legacy"><option value="">Seleciona o teu nome</option></select></label><p><button type="button" id="profile-request">Pedir associação</button></p><p id="profile-status" role="status"></p></div>';
if(!adminPage) {
  const page=document.createElement('section');page.className='page';page.id='perfil';page.append(profilePanel);
  document.querySelector('main').append(page);
  const button=document.createElement('button');button.type='button';button.dataset.page='perfil';button.textContent='Perfil';
  document.querySelector('header nav').append(button);
  button.onclick=()=>{document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p===page));document.querySelectorAll('nav button').forEach(n=>n.classList.toggle('active',n===button));window.scrollTo(0,0)};
}
const profileContent=profilePanel.querySelector('#profile-content'), profileName=profilePanel.querySelector('#profile-name'), profileLegacy=profilePanel.querySelector('#profile-legacy'), profileStatus=profilePanel.querySelector('#profile-status');
legacyBase.then(base=>base.forEach(x=>{const option=document.createElement('option');option.value=x.name;option.textContent=x.name;profileLegacy.append(option)})).catch(console.error);
let profileEpoch=0;
onAuthStateChanged(auth,async user=>{
  const epoch=++profileEpoch;
  profileContent.hidden=!user;
  if(!user)return;
  try{
    const [p,claim,req]=await Promise.all([getDoc(doc(db,'profiles',user.uid)),getDoc(doc(db,'legacyAccounts',user.uid)),getDoc(doc(db,'profileRequests',user.uid))]);
    if(epoch!==profileEpoch)return;
    profileName.value=p.exists()?p.data().displayName:(user.displayName||'');
    profileStatus.textContent=claim.exists()?'Pontos associados a: '+claim.data().legacyName:req.exists()?'Pedido enviado: '+req.data().legacyName+'. Aguarda confirmação.':'';
    profileLegacy.disabled=claim.exists();
    profilePanel.querySelector('#profile-request').disabled=claim.exists();
  }catch(e){console.error(e);profileStatus.textContent='Não foi possível carregar o perfil.'}
});
profilePanel.querySelector('#profile-save').onclick=async()=>{
  const user=auth.currentUser, displayName=profileName.value.trim();
  if(!user||!displayName||displayName.length>80||displayName.includes('@')){profileStatus.textContent='Escreve um nome sem email, com até 80 caracteres.';return}
  try{await setDoc(doc(db,'profiles',user.uid),{displayName});profileStatus.textContent='Nome guardado.';if(document.getElementById('ranking-total').classList.contains('active'))await showStandings('total')}catch(e){console.error(e);profileStatus.textContent='Não foi possível guardar o nome.'}
};
profilePanel.querySelector('#profile-request').onclick=async()=>{
  const user=auth.currentUser, legacyName=profileLegacy.value;
  if(!user||!legacyName){profileStatus.textContent='Seleciona o teu nome anterior.';return}
  try{
    if((await getDoc(doc(db,'legacyAccounts',user.uid))).exists()){profileStatus.textContent='Esta conta já tem pontos associados.';return}
    await setDoc(doc(db,'profileRequests',user.uid),{legacyName,displayName:safePublicName(profileName.value.trim()||user.displayName||'Participante').slice(0,80)});
    profileStatus.textContent='Pedido enviado. Aguarda a confirmação da organização.';
  }catch(e){console.error(e);profileStatus.textContent='Não foi possível enviar o pedido.'}
};
const requestsPanel=document.createElement('div');
requestsPanel.innerHTML='<hr><h2>Pedidos de pontos anteriores</h2><p>Confirma a identidade do participante antes de aprovar.</p><button type="button" id="requests-refresh">Atualizar pedidos</button><div id="requests-list"></div>';
manage.append(requestsPanel);
const requestsList=requestsPanel.querySelector('#requests-list');
async function loadRequests(){
  requestsList.textContent='A carregar…';
  try{
    const [requests,base]=await Promise.all([getDocs(collection(db,'profileRequests')),legacyBase]);
    requestsList.replaceChildren();
    if(requests.empty){requestsList.textContent='Não há pedidos pendentes.';return}
    requests.forEach(item=>{
      const data=item.data(), row=document.createElement('div'), label=document.createElement('p'), approve=document.createElement('button');
      label.textContent=(data.displayName||'Participante')+' pede os pontos de '+data.legacyName;
      approve.textContent='Confirmar associação';approve.type='button';
      approve.onclick=async()=>{
        if(!base.some(x=>x.name===data.legacyName)){label.textContent='Nome anterior não encontrado na classificação.';return}
        approve.disabled=true;
        try{
          const claimRef=doc(db,'legacyClaims',encodeURIComponent(data.legacyName.toLowerCase())), accountRef=doc(db,'legacyAccounts',item.id);
          await runTransaction(db,async tx=>{
            const requestRef=doc(db,'profileRequests',item.id);
            const [claim,account,latest]=await Promise.all([tx.get(claimRef),tx.get(accountRef),tx.get(requestRef)]);
            if(claim.exists()||account.exists())throw new Error('Este nome ou esta conta já tem uma associação.');
            if(!latest.exists()||latest.data().legacyName!==data.legacyName)throw new Error('O pedido foi alterado. Atualiza a lista.');
            tx.set(claimRef,{uid:item.id,legacyName:data.legacyName});
            tx.set(accountRef,{legacyName:data.legacyName});
            tx.delete(requestRef);
          });
          await loadRequests();
        }catch(e){console.error(e);label.textContent='Não foi possível associar: '+(e.message||'verifica as permissões.');approve.disabled=false}
      };
      row.append(label,approve);requestsList.append(row);
    });
  }catch(e){console.error(e);requestsList.textContent='Não foi possível carregar os pedidos.'}
}
requestsPanel.querySelector('#requests-refresh').onclick=loadRequests;



const submissionsPanel=document.createElement('div');
submissionsPanel.innerHTML='<hr><h2>Palpites dos participantes</h2><p>Escolhe uma jornada acima para consultar as respostas.</p><label>Procurar participante <input type="search" id="search-submissions" placeholder="Nome do participante"></label> <button type="button" id="refresh-submissions">Atualizar respostas</button><div id="submissions-list"></div>';
manage.append(submissionsPanel);
const submissionsList=submissionsPanel.querySelector('#submissions-list');
let submissionsVersion=0;
async function loadSubmissions(){
  const version=++submissionsVersion, round=current, user=auth.currentUser;
  submissionsList.replaceChildren();
  if(!adminPage||!user||!adminIds.includes(user.uid)||!round)return;
  submissionsList.textContent='A carregar respostas…';
  try{
    const snap=await getDocs(collection(db,'rounds',round.id,'predictions'));
    if(version!==submissionsVersion||current?.id!==round.id||auth.currentUser?.uid!==user.uid)return;
    submissionsList.replaceChildren();
    const count=document.createElement('p');count.textContent=snap.size+' participante(s) nesta jornada.';submissionsList.append(count);
    const entries=snap.docs.map(d=>d.data()).sort((a,b)=>(a.displayName||'').localeCompare(b.displayName||'','pt'));
    const search=(submissionsPanel.querySelector('#search-submissions').value||'').trim().toLocaleLowerCase('pt');
    entries.filter(p=>(p.displayName||'Participante').toLocaleLowerCase('pt').includes(search)).forEach(p=>{
      const box=document.createElement('details');box.style.cssText='padding:12px 0;border-bottom:1px solid #dbe3eb';
      const title=document.createElement('summary');title.style.cursor='pointer';title.textContent=p.displayName||'Participante';box.append(title);
      const list=document.createElement('ol');
      (round.games||[]).forEach((game,i)=>{const li=document.createElement('li');li.textContent=game+' — '+(p.answers?.[i]||'Sem resposta');list.append(li)});
      box.append(list);submissionsList.append(box);
    });
  }catch(e){console.error(e);if(version===submissionsVersion)submissionsList.textContent='Não foi possível carregar as respostas.'}
}
submissionsPanel.querySelector('#refresh-submissions').onclick=loadSubmissions;
submissionsPanel.querySelector('#search-submissions').addEventListener('change',loadSubmissions);
function syncAdminRound(){
  resultChoices.fill(null);
  [...resultGames.children].forEach((row,i)=>{
    row.querySelector('span').textContent=current?.games?.[i]||'Jogo '+(i+1);
    row.querySelectorAll('button').forEach(b=>{
      const active=current?.results?.[i]===b.textContent;
      b.classList.toggle('active',active);
      if(active)resultChoices[i]=b.textContent;
    });
  });
  loadSubmissions();
}

const saveResultsAction=document.getElementById('save-results').onclick;
document.getElementById('save-results').onclick=async()=>{roundPicker.disabled=true;try{await saveResultsAction()}finally{roundPicker.disabled=false}};



const rankingSelectorLabel=document.createElement('label');
rankingSelectorLabel.textContent='Escolher jornada ';
const rankingSelector=document.createElement('select');
rankingSelector.style.cssText='max-width:100%;padding:10px;margin:8px 0 16px';
rankingSelector.setAttribute('aria-label','Escolher jornada da classificação');
rankingSelectorLabel.append(rankingSelector);
rankingCaption.before(rankingSelectorLabel);
let selectedRanking='', rankingVersion=0, rankingChoices=new Map();
const generalAndOldWeekly=showStandings;
showStandings=async function(which){
  const version=++rankingVersion;
  rankingSelectorLabel.hidden=which!=='weekly';
  if(which!=='weekly')return generalAndOldWeekly(which);
  document.getElementById('ranking-week').classList.add('active');
  document.getElementById('ranking-total').classList.remove('active');
  rankingList.replaceChildren();rankingCaption.textContent='A carregar jornadas…';
  try{
    const [response,stored]=await Promise.all([fetch('classificacao-jornadas.json'),getDocs(collection(db,'publicStandings'))]);
    if(!response.ok)throw new Error('Classificações anteriores indisponíveis');
    const legacy=await response.json();
    if(version!==rankingVersion)return;
    rankingChoices=new Map();
    legacy.forEach(item=>rankingChoices.set('legacy_'+item.id,item));
    stored.forEach(item=>{if(item.id.startsWith('round_'))rankingChoices.set(item.id,item.data())});
    const latest=stored.docs.find(x=>x.id==='weekly');
    if(latest)rankingChoices.set('latest',{...latest.data(),title:'Última jornada publicada — '+(latest.data().title||'Jornada')});
    rankingSelector.replaceChildren();
    rankingChoices.forEach((value,key)=>{const opt=document.createElement('option');opt.value=key;opt.textContent=value.title||'Jornada';rankingSelector.append(opt)});
    if(!rankingChoices.size){rankingCaption.textContent='Ainda não há classificações publicadas.';return}
    if(!rankingChoices.has(selectedRanking))selectedRanking=rankingChoices.has('latest')?'latest':rankingChoices.keys().next().value;
    rankingSelector.value=selectedRanking;
    renderWeeklySelection();
  }catch(e){console.error(e);if(version===rankingVersion)rankingCaption.textContent='Não foi possível carregar as classificações das jornadas.'}
};
function renderWeeklySelection(){
  const data=rankingChoices.get(selectedRanking);rankingList.replaceChildren();
  if(!data){rankingCaption.textContent='Ainda não há classificação publicada.';return}
  rankingCaption.textContent=data.title||'Jornada';
  const rows=Array.isArray(data.rows)?data.rows:[];
  if(!rows.length){rankingCaption.textContent+=' · Ainda não há palpites corrigidos.';return}
  rows.forEach((entry,i)=>{const row=document.createElement('div');row.className='row';const label=document.createElement('span');label.textContent=(i+1)+'.º · '+safePublicName(entry.name);const points=document.createElement('strong');points.textContent=entry.points+' pts';row.append(label,points);rankingList.append(row)});
}
rankingSelector.onchange=()=>{selectedRanking=rankingSelector.value;renderWeeklySelection()};
showStandings('weekly');


const deleteSection=document.createElement('div');
deleteSection.innerHTML='<hr><h2>Gerir jornada</h2><p>Seleciona a jornada acima. Ao eliminar, os palpites e a classificação dessa jornada são apagados.</p><button type="button" id="delete-round">Eliminar jornada selecionada</button>';
manage.append(deleteSection);
deleteSection.querySelector('#delete-round').onclick=async()=>{
  if(!adminIds.includes(auth.currentUser?.uid)||!current){alert('Seleciona uma jornada com a tua conta de organização.');return}
  const chosen={id:current.id,title:current.title};
  if(!confirm('Eliminar permanentemente a jornada "'+chosen.title+'" e todos os seus palpites? Esta ação não pode ser anulada.'))return;
  const button=deleteSection.querySelector('#delete-round');button.disabled=true;roundPicker.disabled=true;
  try{
    const predictions=await getDocs(collection(db,'rounds',chosen.id,'predictions'));
    for(let i=0;i<predictions.docs.length;i+=350){const batch=writeBatch(db);predictions.docs.slice(i,i+350).forEach(d=>batch.delete(d.ref));await batch.commit()}
    await deleteDoc(doc(db,'publicStandings','round_'+chosen.id));
    await deleteDoc(doc(db,'rounds',chosen.id));
    const all=await getDocs(collection(db,'rounds')),totals=new Map(),completed=[];
    for(const round of all.docs){const d=round.data();if(!Array.isArray(d.results)||d.results.length!==7)continue;const ps=await getDocs(collection(db,'rounds',round.id,'predictions'));let rows=[];for(const pred of ps.docs){const p=pred.data();if(!Array.isArray(p.answers))continue;const points=p.answers.reduce((sum,v,i)=>sum+(v===d.results[i]?1:0),0),name=safePublicName(p.displayName);const old=totals.get(pred.id)||{uid:pred.id,name,points:0};old.points+=points;old.name=name;totals.set(pred.id,old);rows.push({name,points})}rows.sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name,'pt'));completed.push({deadline:d.deadline?.toMillis?.()||0,title:d.title||'Jornada',rows})}
    const total=[...totals.values()].sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name,'pt'));
    await setDoc(doc(db,'publicStandings','total'),{rows:total});
    completed.sort((a,b)=>b.deadline-a.deadline);if(completed.length){const {title,rows}=completed[0];await setDoc(doc(db,'publicStandings','weekly'),{title,rows})}else await deleteDoc(doc(db,'publicStandings','weekly'));
    chosenRound=null;selectedRanking='';alert('Jornada eliminada e classificações atualizadas.');await refresh();await showStandings('weekly');
  }catch(e){console.error(e);alert('Não foi possível concluir a eliminação. Algumas alterações podem já ter sido feitas; confirma as permissões e tenta atualizar as classificações.')}finally{button.disabled=false;roundPicker.disabled=false}
};


