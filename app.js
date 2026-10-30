const EVENT_OPEN = false;
(()=>{const $=s=>document.querySelector(s);let ALL=[],qs=[],i=0,mode="practice",picks=[],score=0,locked=false;
const DL={easy:"쉬움",medium:"보통",hard:"어려움"};const URL0=location.href.split(/[?#]/)[0];
const COMMENTS=["아직 지구인이시군요…","케론별 인사부터 시작해볼까요?","침략은 아직 먼 이야기예요","신병 훈련이 조금 더 필요해요","매뉴얼을 한 번만 더 읽어 봐요","케로로 소대 견습 대원","꽤 아는데요? 게로게로~","소대 배식은 맡겨도 되겠어요","진정한 케로로 소대원이에요","거의 케론성 주민","뇌 속은 이미 침략 당하셨군요"];
const show=id=>["home","quiz","result"].forEach(s=>$("#"+s).classList.toggle("hidden",s!==id));
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const toast=m=>{const t=document.createElement("div");t.className="toast";t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),1800)};
function scoreComment(correct,total){const t=total>0?total:10;return COMMENTS[Math.max(0,Math.min(10,Math.round((correct/t)*10)))]}
function eventFromUrl(){const q=new URLSearchParams(location.search);if(["mode","m"].some(k=>(q.get(k)||"").toLowerCase()==="event")||q.has("event"))return true;let hash=location.hash||"";try{hash=decodeURIComponent(hash)}catch(e){}hash=hash.toLowerCase();return hash==="#event"||hash==="#mode=event"||hash==="#/event"||/(?:^|[?&#])mode=event(?:$|&)/.test(hash)}
function denyEvent(){mode="practice";show("home");toast("이벤트 때 열려요!");if(eventFromUrl())history.replaceState(null,"",URL0);return true}
function eventBlocked(){return mode==="event"&&!EVENT_OPEN?denyEvent():false}
const eventBtn=$('[data-mode="event"]'),eventHint=$("#event-hint");
if(eventBtn){if(EVENT_OPEN){eventBtn.classList.remove("is-locked");eventBtn.removeAttribute("aria-disabled");eventBtn.textContent="🎁 이벤트 모드";if(eventHint)eventHint.textContent="10문제 · 끝날 때까지 정답 비공개 · 5개 이상 맞히면 인증코드!"}else{eventBtn.classList.add("is-locked");eventBtn.setAttribute("aria-disabled","true");eventBtn.textContent="이벤트 모드 🔒 준비 중";if(eventHint)eventHint.textContent="이벤트 때 열려요!"}}
if(!EVENT_OPEN&&eventFromUrl())history.replaceState(null,"",URL0);
window.addEventListener("hashchange",()=>{if(!EVENT_OPEN&&eventFromUrl())denyEvent()});
fetch("questions.json",{cache:"no-cache"}).then(r=>r.json()).then(d=>ALL=d).catch(()=>alert("문제를 불러오지 못했어요. 새로고침 해주세요."));
function pick10(){const by={easy:[],medium:[],hard:[]};ALL.forEach(q=>by[q.difficulty].push(q));const sh=a=>a.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(v=>v[1]);
 const out=[...sh(by.easy).slice(0,3),...sh(by.medium).slice(0,4),...sh(by.hard).slice(0,3)];return out}
document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{const next=b.dataset.mode;if(next==="event"&&!EVENT_OPEN)return denyEvent();if(!ALL.length)return toast("문제 불러오는 중…");mode=next;if(eventBlocked())return;qs=pick10();i=0;score=0;picks=[];show("quiz");render();scrollTo(0,0)});
function render(){if(eventBlocked())return;const q=qs[i];locked=false;$("#prog").textContent=`${i+1} / ${qs.length}`;$("#tag").textContent=`${mode==="event"?"🎁 이벤트":"📚 연습"} · ${DL[q.difficulty]} · ${q.topic}`;
 $("#pfill").style.width=(i/qs.length*100)+"%";$("#qtext").textContent=q.question;$("#fb").classList.add("hidden");$("#next").classList.add("hidden");
 $("#opts").innerHTML=q.options.map((o,k)=>`<button class="opt" data-k="${k}">${"①②③④"[k]} ${esc(o)}</button>`).join("");
 $("#opts").querySelectorAll(".opt").forEach(b=>b.onclick=()=>choose(+b.dataset.k))}
function choose(k){if(eventBlocked())return;if(locked)return;locked=true;const q=qs[i];picks[i]=k;if(k===q.answerIndex)score++;const bs=$("#opts").querySelectorAll(".opt");bs.forEach(b=>b.disabled=true);
 if(mode==="practice"){bs[q.answerIndex].classList.add("ok");if(k!==q.answerIndex)bs[k].classList.add("no");
  $("#fb").innerHTML=`<b>${k===q.answerIndex?"⭕ 정답이에요!":"❌ 아쉬워요! 정답: "+esc(q.options[q.answerIndex])}</b><br>${esc(q.explanation)}<br><a href="${esc(q.source)}" target="_self" rel="noopener">출처 보기</a>`;$("#fb").classList.remove("hidden")}
 else bs[k].classList.add("sel");
 $("#next").textContent=i===qs.length-1?"결과 보기 🐸":"다음 ▶";$("#next").classList.remove("hidden");if(mode==="event")setTimeout(next,350)}
$("#next").onclick=()=>next();
function next(){if(eventBlocked())return;if(!locked)return;if(i<qs.length-1){i++;render()}else result()}
async function hash(s){if(crypto.subtle){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
 let h=5381;for(const c of s)h=(h*33^c.charCodeAt(0))>>>0;return h.toString(16).padStart(8,"0")}
function review(){return qs.map((q,k)=>`<div class="rv">${picks[k]===q.answerIndex?"⭕":"❌"} ${esc(q.question)}<br>정답: <b>${esc(q.options[q.answerIndex])}</b> — ${esc(q.explanation)} <a href="${esc(q.source)}">출처</a></div>`).join("")}
async function copy(t){try{await navigator.clipboard.writeText(t);toast("복사했어요! 붙여넣기 해주세요")}catch(e){const a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();try{document.execCommand("copy");toast("복사했어요!")}catch(_){prompt("복사해 주세요",t)}a.remove()}}
function shareText(extra){return `🐸 케로로 퀴즈 ${score}/10 맞혔다 게로!${extra||""}\n너도 도전해봐 👉 ${URL0}`}
function result(){if(eventBlocked())return;$("#pfill").style.width="100%";show("result");scrollTo(0,0);const pass=score>=5;const R=$("#result");
 const msg=scoreComment(score,qs.length);
 let h=`<div class="big">${score} / 10</div><p class="center">${msg}</p>`;
 if(mode==="event"){h+=pass?`<div class="cert"><p class="center"><b>🎉 합격! 이벤트 응모 자격 획득</b></p><input id="nick" maxlength="40" placeholder="닉네임 또는 인스타 @아이디"><button class="btn alt" id="mk">인증코드 받기</button><div id="certout"></div></div>`:`<p class="center">5개 이상 맞혀야 응모할 수 있어요. 다시 도전!</p>`}
 h+=`<button class="btn" id="share">🔗 결과 공유 (복사)</button><button class="btn ghost" id="again">처음으로</button>`;
 if(mode==="practice"||!pass)h+=`<h3>문제 리뷰</h3>`+review();else h+=`<details><summary>문제 리뷰 보기</summary>${review()}</details>`;
 R.innerHTML=h;$("#again").onclick=()=>show("home");$("#share").onclick=()=>copy(shareText());
 if($("#mk"))$("#mk").onclick=async()=>{const n=$("#nick").value.trim();if(!n)return toast("닉네임을 입력해 주세요");const ts=new Date();const tss=ts.toISOString();
  const code=(await hash(`${n}|${score}|${tss}|keroro`)).slice(0,8).toUpperCase();const kst=ts.toLocaleString("ko-KR",{timeZone:"Asia/Seoul"});
  $("#certout").innerHTML=`<div class="code">${code.slice(0,4)}-${code.slice(4)}</div><p class="center">👤 <b>${esc(n)}</b> · ${score}/10 · ${esc(kst)}</p><p class="hint">📸 이 화면을 캡처해서 주최자 DM으로 보내주세요!</p><button class="btn ghost" id="cc">인증 내용 복사</button>`;
  $("#nick").disabled=true;$("#mk").remove();$("#cc").onclick=()=>copy(`[케로로 퀴즈 이벤트 인증]\n닉네임: ${n}\n점수: ${score}/10\n시각: ${kst}\n코드: ${code.slice(0,4)}-${code.slice(4)}\n(검증값: ${tss})`)}}
})();
