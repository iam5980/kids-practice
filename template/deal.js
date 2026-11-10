/* ===== KPDeal：選擇題正確答案位置平均分散（練習小站共用，版本 2026-11-10b）=====
   規則：每個位置（A/B/C/D…）出現次數一樣多，且正確答案不會連續 3 題在同一位置。
   用法（整段貼進 App 的 <script>，放在使用它的程式之前）：
     KPDeal.place(options, correct)   → 回傳新陣列：錯誤選項打亂，正確選項放到平均分散的位置
                                         correct 可以是「值」或「判斷函式 (item,index)=>boolean」
     KPDeal.pos(n)                    → 只要位置編號（0..n-1）時使用
     KPDeal.shuffle(arr)              → 一般打亂（回傳新陣列）
   注意：凡是「一題 + 數個選項 + 一個正解」的地方都要用 place，不要再用 shuffle 決定選項順序。
*/
var KPDeal=(function(){
  var decks={},last=[];
  function sh(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}return a}
  function runOK(s){for(var i=2;i<s.length;i++)if(s[i]===s[i-1]&&s[i]===s[i-2])return false;return true}
  function pos(n){
    if(!(n>1))return 0;
    var d=decks[n];
    if(!d||!d.length){var base=[],k=0;for(var r=0;r<2;r++)for(var i=0;i<n;i++)base.push(i);
      do{d=sh(base);k++}while(!runOK(last.slice(-2).concat(d))&&k<300);decks[n]=d}
    var p=d.shift();
    if(last.length>=2&&last[last.length-1]===p&&last[last.length-2]===p){
      for(var i=0;i<d.length;i++)if(d[i]!==p){var q=d[i];d[i]=p;p=q;break}
      if(last[last.length-1]===p&&last[last.length-2]===p){var alt=(p+1+Math.floor(Math.random()*(n-1)))%n;d.push(p);p=alt}}
    last.push(p);if(last.length>4)last.shift();
    return p;
  }
  function place(arr,correct){
    var f=typeof correct==='function'?correct:function(x){return x===correct};
    var ci=-1;for(var i=0;i<arr.length;i++)if(f(arr[i],i)){ci=i;break}
    if(ci<0)return sh(arr);
    var c=arr[ci],w=sh(arr.filter(function(_,i){return i!==ci}));
    w.splice(pos(arr.length),0,c);
    return w;
  }
  return {place:place,pos:pos,shuffle:sh};
})();
