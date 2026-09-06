/* ===== Mandje — QR-encoder (prelude-module, geen afhankelijkheden) =====
   Byte-modus, foutcorrectie M, versie 1–10 (tot 216 bytes: ruim genoeg voor een uitnodig-link).
   Standaard ISO/IEC 18004: Reed-Solomon over GF(256) (0x11D), 8 maskers met penalty-keuze,
   format-info BCH(15,5), version-info BCH(18,6) vanaf versie 7.
   API: qrMatrix(text) → { size, get(r,c) }   ·   qrSvg(text, opts) → SVG-string (currentColor) */
var QR = (function(){
  // [versie] → { data: totaal datacodewords, ec: ec-codewords per blok, blocks: [[aantal, totaalPerBlok, dataPerBlok], …] }
  var SPEC = {
    1:{ data:16,  ec:10, blocks:[[1,26,16]] },
    2:{ data:28,  ec:16, blocks:[[1,44,28]] },
    3:{ data:44,  ec:26, blocks:[[1,70,44]] },
    4:{ data:64,  ec:18, blocks:[[2,50,32]] },
    5:{ data:86,  ec:24, blocks:[[2,67,43]] },
    6:{ data:108, ec:16, blocks:[[4,43,27]] },
    7:{ data:124, ec:18, blocks:[[4,49,31]] },
    8:{ data:154, ec:22, blocks:[[2,60,38],[2,61,39]] },
    9:{ data:182, ec:22, blocks:[[3,58,36],[2,59,37]] },
    10:{ data:216, ec:26, blocks:[[4,69,43],[1,70,44]] }
  };
  var ALIGN = { 1:[], 2:[6,18], 3:[6,22], 4:[6,26], 5:[6,30], 6:[6,34], 7:[6,22,38], 8:[6,24,42], 9:[6,26,46], 10:[6,28,50] };

  // GF(256)
  var EXP = new Array(512), LOG = new Array(256);
  (function(){ var x=1; for(var i=0;i<255;i++){ EXP[i]=x; LOG[x]=i; x<<=1; if(x&0x100) x^=0x11D; } for(var j=255;j<512;j++) EXP[j]=EXP[j-255]; })();
  function gmul(a,b){ if(!a||!b) return 0; return EXP[LOG[a]+LOG[b]]; }
  function rsGenerator(n){ var g=[1]; for(var i=0;i<n;i++){ var ng=new Array(g.length+1).fill(0); for(var j=0;j<g.length;j++){ ng[j]^=g[j]; ng[j+1]^=gmul(g[j], EXP[i]); } g=ng; } return g; }
  function rsEncode(data, n){
    var gen=rsGenerator(n), res=new Array(n).fill(0);
    for(var i=0;i<data.length;i++){
      var coef=data[i]^res[0];
      res.shift(); res.push(0);
      if(coef){ for(var j=0;j<n;j++) res[j]^=gmul(gen[j+1], coef); }
    }
    return res;
  }

  function utf8(str){ var out=[], s=unescape(encodeURIComponent(str)); for(var i=0;i<s.length;i++) out.push(s.charCodeAt(i)); return out; }

  function pickVersion(len){ for(var v=1; v<=10; v++){ var cc = v<10 ? 8 : 16; var bits = 4 + cc + len*8; if(bits <= SPEC[v].data*8) return v; } return 0; }

  function buildCodewords(bytes, v){
    var spec=SPEC[v], bits=[];
    function push(val, n){ for(var i=n-1;i>=0;i--) bits.push((val>>i)&1); }
    push(4,4); push(bytes.length, v<10?8:16);
    bytes.forEach(function(b){ push(b,8); });
    var cap=spec.data*8;
    var term=Math.min(4, cap-bits.length); push(0, term);
    while(bits.length%8) bits.push(0);
    var data=[]; for(var i=0;i<bits.length;i+=8){ var b=0; for(var j=0;j<8;j++) b=(b<<1)|bits[i+j]; data.push(b); }
    var pads=[0xEC,0x11], p=0; while(data.length<spec.data){ data.push(pads[p]); p^=1; }
    // blokken
    var blocks=[], ecs=[], off=0;
    spec.blocks.forEach(function(bl){ for(var k=0;k<bl[0];k++){ var d=data.slice(off, off+bl[2]); off+=bl[2]; blocks.push(d); ecs.push(rsEncode(d, spec.ec)); } });
    // interleaven
    var out=[], maxD=Math.max.apply(null, blocks.map(function(b){return b.length;}));
    for(var i2=0;i2<maxD;i2++) blocks.forEach(function(b){ if(i2<b.length) out.push(b[i2]); });
    for(var i3=0;i3<spec.ec;i3++) ecs.forEach(function(e){ out.push(e[i3]); });
    return out;
  }

  function makeMatrix(v){
    var size=17+4*v, m=[], f=[];
    for(var r=0;r<size;r++){ m.push(new Array(size).fill(0)); f.push(new Array(size).fill(false)); }
    function set(r,c,val){ m[r][c]=val?1:0; f[r][c]=true; }
    function finder(r0,c0){ for(var r=-1;r<=7;r++) for(var c=-1;c<=7;c++){ var rr=r0+r, cc=c0+c; if(rr<0||cc<0||rr>=size||cc>=size) continue; var on = (r>=0&&r<=6&&(c===0||c===6)) || (c>=0&&c<=6&&(r===0||r===6)) || (r>=2&&r<=4&&c>=2&&c<=4); set(rr,cc,on); } }
    finder(0,0); finder(0,size-7); finder(size-7,0);
    // timing
    for(var i=8;i<size-8;i++){ set(6,i,i%2===0); set(i,6,i%2===0); }
    // alignment
    var al=ALIGN[v];
    for(var a=0;a<al.length;a++) for(var b=0;b<al.length;b++){
      var r=al[a], c=al[b];
      // alleen de drie posities die een finder raken vervallen; overlap met de timing-lijn is juist de bedoeling
      if((r<=8 && c<=8) || (r<=8 && c>=size-9) || (r>=size-9 && c<=8)) continue;
      for(var dr=-2;dr<=2;dr++) for(var dc=-2;dc<=2;dc++){ var on=(Math.max(Math.abs(dr),Math.abs(dc))!==1); set(r+dr,c+dc,on); }
    }
    // dark module + format-gebieden reserveren
    set(size-8,8,true);
    for(var k=0;k<8;k++){ if(!f[8][k]) set(8,k,false); if(!f[k][8]) set(k,8,false); if(!f[8][size-1-k]) set(8,size-1-k,false); if(!f[size-1-k][8]) set(size-1-k,8,false); }
    if(!f[8][8]) set(8,8,false);
    if(v>=7){ for(var i2=0;i2<6;i2++) for(var j2=0;j2<3;j2++){ set(size-11+j2,i2,false); set(i2,size-11+j2,false); } }
    return { size:size, m:m, f:f };
  }

  function placeData(mat, codewords){
    var size=mat.size, m=mat.m, f=mat.f, bitIdx=0, total=codewords.length*8;
    function bit(i){ return (codewords[i>>3]>>(7-(i&7)))&1; }
    var up=true;
    for(var col=size-1; col>0; col-=2){
      if(col===6) col--;
      for(var i=0;i<size;i++){
        var r = up ? size-1-i : i;
        for(var d=0; d<2; d++){
          var c=col-d;
          if(f[r][c]) continue;
          m[r][c] = bitIdx<total ? bit(bitIdx) : 0;
          bitIdx++;
        }
      }
      up=!up;
    }
  }

  function maskFn(k,r,c){
    switch(k){
      case 0: return (r+c)%2===0;
      case 1: return r%2===0;
      case 2: return c%3===0;
      case 3: return (r+c)%3===0;
      case 4: return (Math.floor(r/2)+Math.floor(c/3))%2===0;
      case 5: return (r*c)%2+(r*c)%3===0;
      case 6: return ((r*c)%2+(r*c)%3)%2===0;
      default: return ((r+c)%2+(r*c)%3)%2===0;
    }
  }
  /* BCH-rest: value (5 of 6 bits) verschoven met de graad van de generator, rest via polynoomdeling over GF(2) */
  function bch(value, poly, totalBits){
    var deg = Math.floor(Math.log2(poly));        // 10 voor 0x537 (format), 12 voor 0x1F25 (version)
    var d = value << deg;
    for(var i=totalBits-1; i>=deg; i--){ if(d & (1<<i)) d ^= poly << (i-deg); }
    return (value << deg) | d;
  }
  function formatBits(mask){ var data=(0<<3)|mask; /* niveau M = 00 */ var v=bch(data, 0x537, 15); return v ^ 0x5412; }
  function versionBits(v){ return bch(v, 0x1F25, 18); }

  function applyMask(mat, k){
    var size=mat.size, m=mat.m, f=mat.f, out=[];
    for(var r=0;r<size;r++){ out.push(m[r].slice()); for(var c=0;c<size;c++){ if(!f[r][c] && maskFn(k,r,c)) out[r][c]^=1; } }
    // format-info
    var fb=formatBits(k);
    for(var i=0;i<15;i++){
      var b=(fb>>i)&1;
      // eerste kopie rond de linksboven-finder: bits 0–5 in kolom 8 (rijen 0–5), bit 6 op (7,8), bit 7 op (8,8), bit 8 op (8,7), bits 9–14 in rij 8 (kolommen 5–0)
      if(i<6) out[i][8]=b; else if(i===6) out[7][8]=b; else if(i===7) out[8][8]=b; else if(i===8) out[8][7]=b; else out[8][14-i]=b;
      // tweede kopie: bits 0–7 in rij 8 rechts (kolommen size-1 … size-8), bits 8–14 in kolom 8 onder (rijen size-7 … size-1)
      if(i<8) out[8][size-1-i]=b; else out[size-15+i][8]=b;
    }
    return out;
  }
  function placeVersion(out, v){
    if(v<7) return; var size=out.length, vb=versionBits(v);
    for(var i=0;i<18;i++){ var b=(vb>>i)&1; var r=Math.floor(i/3), c=i%3; out[size-11+c][r]=b; out[r][size-11+c]=b; }
  }
  function penalty(g){
    var n=g.length, score=0, r, c;
    // regel 1: runs ≥5
    for(r=0;r<n;r++){ var run=1; for(c=1;c<n;c++){ if(g[r][c]===g[r][c-1]){ run++; if(run===5) score+=3; else if(run>5) score++; } else run=1; } }
    for(c=0;c<n;c++){ var run2=1; for(r=1;r<n;r++){ if(g[r][c]===g[r-1][c]){ run2++; if(run2===5) score+=3; else if(run2>5) score++; } else run2=1; } }
    // regel 2: 2×2-blokken
    for(r=0;r<n-1;r++) for(c=0;c<n-1;c++){ var s=g[r][c]+g[r][c+1]+g[r+1][c]+g[r+1][c+1]; if(s===0||s===4) score+=3; }
    // regel 3: finder-achtig patroon 1011101 met 4 lichte modules ernaast
    var pat1=[1,0,1,1,1,0,1,0,0,0,0], pat2=[0,0,0,0,1,0,1,1,1,0,1];
    function matchAt(get, len){ for(var i=0;i<=len-11;i++){ var ok1=true, ok2=true; for(var j=0;j<11;j++){ var v=get(i+j); if(v!==pat1[j]) ok1=false; if(v!==pat2[j]) ok2=false; if(!ok1&&!ok2) break; } if(ok1||ok2) score+=40; } }
    for(r=0;r<n;r++){ (function(rr){ matchAt(function(i){ return g[rr][i]; }, n); })(r); }
    for(c=0;c<n;c++){ (function(cc){ matchAt(function(i){ return g[i][cc]; }, n); })(c); }
    // regel 4: donker-aandeel
    var dark=0; for(r=0;r<n;r++) for(c=0;c<n;c++) dark+=g[r][c];
    var pct=dark*100/(n*n), prev=Math.floor(pct/5)*5, next=prev+5;
    score += Math.min(Math.abs(prev-50), Math.abs(next-50))/5*10;
    return score;
  }

  function qrMatrix(text){
    var bytes=utf8(String(text||"")), v=pickVersion(bytes.length);
    if(!v) return null;
    var cw=buildCodewords(bytes, v);
    var mat=makeMatrix(v);
    placeData(mat, cw);
    var best=null, bestScore=Infinity;
    for(var k=0;k<8;k++){ var g=applyMask(mat,k); placeVersion(g, v); var p=penalty(g); if(p<bestScore){ bestScore=p; best=g; } }
    return { size:mat.size, version:v, get:function(r,c){ return best[r][c]===1; }, rows:best };
  }
  function qrSvg(text, opts){
    opts=opts||{};
    var q=qrMatrix(text); if(!q) return "";
    var quiet=(opts.quiet==null)?4:opts.quiet, n=q.size, dim=n+quiet*2, d="";
    for(var r=0;r<n;r++) for(var c=0;c<n;c++){ if(q.get(r,c)) d+="M"+(c+quiet)+" "+(r+quiet)+"h1v1h-1z"; }
    var px=opts.px||200;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+dim+' '+dim+'" width="'+px+'" height="'+px+'" shape-rendering="crispEdges" role="img" aria-label="'+(opts.label||"QR-code")+'"><rect width="'+dim+'" height="'+dim+'" fill="'+(opts.bg||"#fff")+'"/><path d="'+d+'" fill="'+(opts.fg||"#000")+'"/></svg>';
  }
  return { matrix:qrMatrix, svg:qrSvg, _spec:SPEC };
})();
var qrMatrix = QR.matrix, qrSvg = QR.svg;
