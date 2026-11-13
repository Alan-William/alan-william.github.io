(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const categories = ["全部分类","科研","课程","项目","竞赛","个人","其他"];
  const labels = {todo:"待开始",doing:"进行中",done:"已完成",cancelled:"已取消"};
  const priorities = {high:{label:"高优先",rank:0},medium:{label:"中优先",rank:1},low:{label:"低优先",rank:2}};
  const state = {tasks:[],status:"active",category:"全部分类",sort:"smart",query:"",loaded:false};
  const escapeHTML = x => String(x == null ? "" : x).replace(/[&<>"']/g,c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const isOpen = t => t.status!=="done"&&t.status!=="cancelled";
  const rank = t => (priorities[t.priority]||priorities.medium).rank;
  function daysUntil(ymd) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(ymd||"")) return null;
    const date=new Date(ymd+"T00:00:00");
    if(Number.isNaN(date.getTime())) return null;
    const today=new Date(); today.setHours(0,0,0,0);
    return Math.round((date-today)/86400000);
  }
  function deadline(t) {
    if(!t.due) return {text:"无截止日期",css:""};
    const d=daysUntil(t.due);
    if(d===null) return {text:t.due,css:""};
    if(!isOpen(t)) return {text:"截止 "+t.due.slice(5).replace("-","/"),css:""};
    if(d<0) return {text:"逾期 "+(-d)+" 天",css:"late"};
    if(d===0) return {text:"今天截止",css:"late"};
    if(d===1) return {text:"明天截止",css:"warn"};
    if(d<=3) return {text:d+" 天后截止",css:"warn"};
    return {text:"截止 "+t.due.slice(5).replace("-","/"),css:""};
  }
  function isUrgent(t) {
    const d=daysUntil(t.due);
    return isOpen(t)&&(t.priority==="high"||(d!==null&&d<=3));
  }
  function score(t) {
    const d=daysUntil(t.due);
    return (isOpen(t)?0:1e8)+(isUrgent(t)?-100000:0)+(d===null?25000:Math.max(d,-1000)*50)+rank(t)*300+(t.status==="doing"?-75:0);
  }
  function sorted(arr,mode) {
    return arr.sort((a,b)=>{
      if(mode==="recent") return String(b.updatedAt||b.createdAt||"").localeCompare(String(a.updatedAt||a.createdAt||""));
      if(mode==="priority") return rank(a)-rank(b)||score(a)-score(b);
      if(mode==="due") {
        const ad=daysUntil(a.due),bd=daysUntil(b.due);
        return (ad===null?999999:ad)-(bd===null?999999:bd)||rank(a)-rank(b);
      }
      return score(a)-score(b)||String(b.createdAt||"").localeCompare(String(a.createdAt||""));
    });
  }
  function safeUrl(raw) {
    try {const url=new URL(String(raw),location.href);return ["http:","https:"].includes(url.protocol)?url.href:"";}
    catch (_) {return "";}
  }
  function toast(msg) {
    const el=$("toast");el.textContent=msg;el.classList.add("show");
    clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),2600);
  }
  async function copy(text) {
    try {
      if(navigator.clipboard&&window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const el=document.createElement("textarea");el.value=text;el.style.position="fixed";el.style.opacity="0";
        document.body.appendChild(el);el.select();const ok=document.execCommand("copy");el.remove();
        if(!ok) throw new Error("copy failed");
      }
      return true;
    } catch (_) {return false;}
  }
  function renderCategories() {
    $("categories").innerHTML=categories.map(cat=>'<button type="button" data-cat="'+escapeHTML(cat)+'" aria-pressed="'+(cat===state.category)+'" class="'+(cat===state.category?"active":"")+'">'+escapeHTML(cat)+'</button>').join("");
    $("categories").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{
      state.category=btn.dataset.cat;renderCategories();renderList();
    }));
  }
  function subtaskProgress(t) {
    if(!Array.isArray(t.checklist)||!t.checklist.length)return "";
    const n=t.checklist.filter(s=>s&&s.done).length,p=Math.round(n/t.checklist.length*100);
    return '<div class="check-progress"><span>子任务 '+n+'/'+t.checklist.length+'</span><div class="bar"><i style="width:'+p+'%"></i></div><span>'+p+'%</span></div>';
  }
  function taskCard(t) {
    const finished=t.status==="done",p=priorities[t.priority]||priorities.medium,d=deadline(t);
    const command=finished?'把待办「'+t.title+'」（ID: '+t.id+'）重新设为待开始':'把待办「'+t.title+'」（ID: '+t.id+'）标记为完成';
    const url=safeUrl(t.link);
    const tags=Array.isArray(t.tags)?t.tags.slice(0,2):[];
    return '<details class="task '+(finished?"finished":"")+'">'+
      '<summary class="task-summary"><span class="task-check" aria-hidden="true">'+(finished?"✓":t.status==="doing"?"●":"□")+'</span>'+
      '<span class="task-body"><span class="task-top"><strong class="task-title">'+escapeHTML(t.title)+'</strong>'+
      '<span class="badge '+(finished?"done":escapeHTML(t.priority||"medium"))+'">'+(finished?"已完成":escapeHTML(p.label))+'</span></span>'+
      '<span class="meta"><span>'+escapeHTML(t.category||"其他")+'</span><span class="meta-sep">·</span>'+
      '<span class="due '+d.css+'">◷ '+escapeHTML(d.text)+'</span>'+
      (t.status==="doing"?'<span class="state-doing">进行中</span>':"")+
      tags.map(tag=>'<span>#'+escapeHTML(tag)+'</span>').join("")+'</span></span><span class="task-chevron" aria-hidden="true">⌄</span></summary>'+
      '<div class="task-extra">'+
      (t.description?'<p class="description">'+escapeHTML(t.description)+'</p>':'<p class="description quiet">暂无详细说明</p>')+
      subtaskProgress(t)+'<div class="task-foot">'+
      (url?'<a href="'+escapeHTML(url)+'" target="_blank" rel="noopener noreferrer">↗ 关联链接</a>':'<small>#'+escapeHTML(t.id)+'</small>')+
      '<button type="button" data-command="'+escapeHTML(command)+'">'+(finished?"↶ 重新开始":"✓ 标记完成")+'</button></div></div></details>';
  }
  function renderList() {
    if(!state.loaded)return;
    const tasks=sorted(state.tasks.filter(t=>
      (state.category==="全部分类"||t.category===state.category)&&
      (state.status==="all"||(state.status==="active"?isOpen(t):t.status===state.status))&&
      (!state.query||[t.title,t.description,t.id,t.category,...(Array.isArray(t.tags)?t.tags:[])].join(" ").toLowerCase().includes(state.query))
    ),state.sort);
    $("visibleCount").textContent=tasks.length+" 项";
    if(tasks.length) {
      $("list").innerHTML=tasks.map(taskCard).join("");
      $("list").querySelectorAll("[data-command]").forEach(btn=>btn.addEventListener("click",async()=>{
        toast(await copy(btn.dataset.command)?"已复制修改指令，请粘贴到 ChatGPT":"复制失败，请直接在 ChatGPT 告诉我");
      }));
    } else {
      const blank=!state.tasks.length;
      $("list").innerHTML='<div class="empty"><div class="empty-icon">'+(blank?"☑":"⌕")+'</div><strong>'+
        (blank?"这里还没有任务":"没有符合条件的任务")+'</strong><p>'+
        (blank?"直接告诉 ChatGPT 想添加什么，我会同步到这里。":"试试更换状态、分类或清空搜索。")+'</p></div>';
    }
  }
  function renderStats() {
    const arr=state.tasks.filter(t=>t.status!=="cancelled");
    const todo=arr.filter(t=>t.status==="todo").length,doing=arr.filter(t=>t.status==="doing").length,done=arr.filter(t=>t.status==="done").length,urgent=arr.filter(isUrgent).length;
    $("countTodo").textContent=todo;$("countDoing").textContent=doing;$("countDone").textContent=done;$("countUrgent").textContent=urgent;
    const percent=arr.length?Math.round(done/arr.length*100):0;
    const percentage=$("percent"), ring=$("ring");
    if(percentage) percentage.textContent=percent+"%";
    if(ring) ring.style.setProperty("--p",percent+"%");
    const heroOpen=$("heroOpen"), heroUrgent=$("heroUrgent");
    if(heroOpen) heroOpen.textContent=(todo+doing)+" 件待推进";
    if(heroUrgent) heroUrgent.textContent=urgent?urgent+" 件需要优先处理":"先做最重要的一件事";
  }
  function renderFocus() {
    const arr=sorted(state.tasks.filter(isUrgent),"smart").slice(0,4);
    $("focus").innerHTML=arr.length?arr.map(t=>
      '<div class="focus-item"><div class="stripe"></div><div><strong>'+escapeHTML(t.title)+'</strong><small>'+
      escapeHTML(t.category||"其他")+' · '+escapeHTML(deadline(t).text==="无截止日期"?(priorities[t.priority]||priorities.medium).label:deadline(t).text)+'</small></div></div>'
    ).join(""):'<span class="focus-none">目前没有紧急任务。<br>有新事项随时告诉 ChatGPT。</span>';
  }
  function render() {renderCategories();renderStats();renderFocus();renderList();}
  async function load(silent) {
    $("refresh").disabled=true;$("statusText").textContent="正在同步";
    try {
      const r=await fetch("./tasks.json?fresh="+Date.now(),{cache:"no-store"});
      if(!r.ok)throw new Error("HTTP "+r.status);
      const data=await r.json();
      if(!data||!Array.isArray(data.tasks))throw new Error("任务数据格式错误");
      state.tasks=data.tasks.filter(t=>t&&t.id&&typeof t.title==="string").map(t=>({
        id:String(t.id),title:t.title,description:t.description||"",category:t.category||"其他",status:t.status||"todo",
        priority:t.priority||"medium",due:t.due||"",link:t.link||"",tags:t.tags||[],checklist:t.checklist||[],
        createdAt:t.createdAt||"",updatedAt:t.updatedAt||""
      }));
      state.loaded=true;render();$("statusText").textContent="已同步 GitHub";
      const date=data.updatedAt?new Date(data.updatedAt):null;
      $("updated").textContent=date&&!Number.isNaN(date.getTime())?date.toLocaleString("zh-CN",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}):"未知";
      if(!silent)toast("已获取最新任务");
    } catch(e) {
      state.loaded=true;render();$("statusText").textContent="同步失败";
      if(!state.tasks.length)$("list").innerHTML='<div class="empty"><div class="empty-icon">!</div><strong>暂时无法读取任务</strong><p>请检查网络后点击「刷新」。</p></div>';
      if(!silent)toast("同步失败："+String(e.message||e));
    } finally {$("refresh").disabled=false;}
  }
  function init() {
    const todayLabel=$("today");
    if(todayLabel) todayLabel.textContent=new Intl.DateTimeFormat("zh-CN",{month:"long",day:"numeric",weekday:"long"}).format(new Date());
    $("search").addEventListener("input",e=>{state.query=e.target.value.trim().toLowerCase();renderList();});
    $("sort").addEventListener("change",e=>{state.sort=e.target.value;renderList();});
    $("statuses").querySelectorAll("[data-status]").forEach(btn=>btn.addEventListener("click",()=>{
      state.status=btn.dataset.status;
      $("statuses").querySelectorAll("[data-status]").forEach(x=>{x.classList.toggle("active",x===btn);x.setAttribute("aria-pressed",String(x===btn));});
      renderList();
    }));
    $("refresh").addEventListener("click",()=>load(false));
    $("copyCapture").addEventListener("click",async()=>{
      const value=$("capture").value.trim();
      if(!value){$("copyHint").textContent="先写下你要记的事情。";$("capture").focus();return;}
      const instruction="请将下面事项添加到我的 GitHub Pages 待办中心（Alan-William/alan-william.github.io 仓库的 todo/tasks.json）。根据内容判断分类和优先级；没有给定的截止日期请留空，不要编造：\n"+value;
      const ok=await copy(instruction);
      $("copyHint").textContent=ok?"✓ 已复制，去 ChatGPT 粘贴发送即可。":"复制失败，请直接把内容发给 ChatGPT。";
      if(ok)toast("指令已复制");
    });
    renderCategories();load(true);
    window.setInterval(()=>{if(!document.hidden)load(true);},300000);
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)load(true);});
  }
  init();
})();