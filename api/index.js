// api/index.js - BRONX OSINT V100 ULTRA PRIME V7.0 - BLOOD THEME
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();

const REAL_API_BASE = 'https://ft-osint-api.duckdns.org/api';
const REAL_API_KEY = process.env.REAL_API_KEY || 'bot-new';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'BRONX_ULTRA';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'king5';
const MASTER_API_KEY = process.env.MASTER_API_KEY || 'BRONX_MASTER_' + Math.random().toString(36).substring(2, 10).toUpperCase();

// Render Disk Storage
const DATA_DIR = process.env.RENDER_DATA_DIR || '/tmp';
const DATA_FILE = path.join(DATA_DIR, 'bronx_v7_data.json');

let keyStorage = {};
let customAPIs = [];
let requestLogs = [];
let adminSessions = {};
let permanentTokens = {};
let bannedIPs = [];
let cooldownTimers = {};
let ipRequestCount = {};

// ========== RENDER DISK STORAGE ==========
function saveToDisk() {
    try {
        const keysToSave = {};
        Object.entries(keyStorage).forEach(([k, v]) => {
            if (!v._hardcoded) keysToSave[k] = v;
        });
        const fullData = {
            keys: keysToSave,
            apis: customAPIs,
            tokens: permanentTokens,
            banned: bannedIPs,
            logs: requestLogs.slice(-500),
            _savedAt: getIndiaDateTime()
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(fullData, null, 2));
        console.log(`💾 Saved! Keys: ${Object.keys(keysToSave).length}`);
    } catch (e) {
        console.log('Save err:', e.message);
    }
}

function loadFromDisk() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            if (d.keys) Object.entries(d.keys).forEach(([k, v]) => { keyStorage[k] = v; });
            if (d.apis?.length > 0) customAPIs = d.apis;
            if (d.tokens) {
                permanentTokens = d.tokens;
                Object.entries(permanentTokens).forEach(([t]) => {
                    adminSessions[t] = { expiresAt: Date.now() + (365*24*60*60*1000), permanent: true };
                });
            }
            if (d.banned) bannedIPs = d.banned;
            if (d.logs) requestLogs = d.logs;
            console.log(`📥 Loaded! Keys: ${Object.keys(d.keys||{}).length}`);
            return true;
        }
    } catch (e) {
        console.log('Load err:', e.message);
    }
    return false;
}

function scheduleSave() {
    setTimeout(() => saveToDisk(), 2000);
}
setInterval(() => scheduleSave(), 5 * 60 * 1000);

// ========== HELPERS ==========
function getIndiaTime() {
    return new Date(new Date().getTime() + (5.5*60*60*1000));
}

function getIndiaDate() {
    return getIndiaTime().toISOString().split('T')[0];
}

function getIndiaDateTime() {
    return getIndiaTime().toISOString().replace('T',' ').substring(0,19);
}

function isKeyExpired(d) {
    if(!d||d==='LIFETIME') return false;
    return getIndiaTime() > new Date(d);
}

function parseExpiryDate(s) {
    if(!s||s==='LIFETIME') return null;
    const p=s.split('-');
    if(p.length===3) return p[0].length===4?new Date(+p[0],+p[1]-1,+p[2],23,59,59):new Date(+p[2],+p[1]-1,+p[0],23,59,59);
    const d=new Date(s);
    return isNaN(d.getTime())?null:d;
}

function checkCooldown(k) {
    const kd=keyStorage[k];
    if(!kd||!kd.cooldown) return {allowed:true};
    const n=Date.now();
    if(cooldownTimers[k]&&(n-cooldownTimers[k])<(kd.cooldown*1000)) {
        return {allowed:false,remaining:Math.ceil((kd.cooldown*1000-(n-cooldownTimers[k]))/1000)};
    }
    cooldownTimers[k]=n;
    return {allowed:true};
}

function checkKeyValid(k) {
    if(!k) return {valid:false,error:'Missing key'};
    const kd=keyStorage[k];
    if(!kd) return {valid:false,error:'Key not found'};
    if(kd.expiry&&isKeyExpired(kd.expiry)) return {valid:false,error:'Key expired on '+kd.expiryStr};
    if(!kd.unlimited&&kd.used>=kd.limit) {
        return {
            valid:false,
            error:`⚠️ LIMIT REACHED ${kd.limit}/${kd.limit}\n📱 PAID API AVAILABLE\n💎 Unlimited Requests\n📩 DM @BRONX_ULTRA`,
            limitReached: true
        };
    }
    const cd=checkCooldown(k);
    if(!cd.allowed) return {valid:false,error:'⏳ Cooldown '+cd.remaining+'s remaining'};
    return {valid:true,keyData:kd};
}

function incrementKeyUsage(k) {
    if(keyStorage[k]&&!keyStorage[k].unlimited) {
        keyStorage[k].used++;
        if(keyStorage[k].used%5===0) scheduleSave();
    }
}

function checkKeyScope(kd,ep) {
    if(!kd?.scopes?.length) return {valid:false,error:'No scopes'};
    if(kd.scopes.includes('*')) return {valid:true};
    if(kd.scopes.includes(ep)) return {valid:true};
    if(ep.startsWith('c/')&&kd.scopes.includes('custom')) return {valid:true};
    return {valid:false,error:`Scope denied. Required: ${ep}`};
}

function generateToken() {
    const c='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let t='';
    for(let i=0;i<32;i++) t+=c.charAt(Math.floor(Math.random()*c.length));
    return t;
}

function isAdminAuth(t) {
    if(!t) return false;
    if(adminSessions[t]) {
        if(adminSessions[t].permanent) return true;
        if(Date.now()<adminSessions[t].expiresAt) return true;
        delete adminSessions[t];
        delete permanentTokens[t];
    }
    return false;
}

function isIPBanned(ip) {
    return ip&&ip!=='unknown'&&bannedIPs.includes(ip);
}

function banIP(ip) {
    if(ip&&ip!=='unknown'&&!bannedIPs.includes(ip)) {
        bannedIPs.push(ip);
        scheduleSave();
    }
}

function unbanIP(ip) {
    const i=bannedIPs.indexOf(ip);
    if(i>-1) {
        bannedIPs.splice(i,1);
        scheduleSave();
    }
}

function sanitizeResponse(d, keyData) {
    if(!d) return d;
    try {
        const c=JSON.parse(JSON.stringify(d));
        delete c.credit;delete c.truecaller_name;delete c.cached;delete c.cached_at;
        delete c.api_by;delete c.by;delete c.channel;delete c.developer;
        delete c.api_key;delete c.real_url;delete c.source_url;
        if(c.meta){
            delete c.meta.api_by;delete c.meta.response_time_ms;delete c.meta.quota_used;
            if(Object.keys(c.meta).length===0)delete c.meta;
        }
        
        // ADD CUSTOM INFO
        c.powered_by = "BRONX_ULTRA_V7";
        c.key_info = {
            created_date: keyData?.created || 'N/A',
            expiry_date: keyData?.expiryStr || 'LIFETIME',
            remaining_requests: keyData?.unlimited ? '∞' : Math.max(0, (keyData?.limit||0) - (keyData?.used||0)),
            cooldown_seconds: keyData?.cooldown || 0
        };
        c.contact = "@BRONX_ULTRA";
        
        return c;
    } catch(e) {
        return d;
    }
}

function esc(s) {
    if(!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function createMasterKey() {
    return {
        name:'👑 OWNER',
        scopes:['*'],
        type:'owner',
        limit:999999,
        used:0,
        cooldown:0,
        expiry:null,
        expiryStr:'LIFETIME',
        created:getIndiaDateTime(),
        unlimited:true,
        hidden:true,
        _hardcoded:false
    };
}

// ========== DDoS PROTECTION ==========
function checkDDoS(ip) {
    if (!ip || ip === 'unknown') return true;
    const now = Date.now();
    if (!ipRequestCount[ip]) ipRequestCount[ip] = [];
    ipRequestCount[ip] = ipRequestCount[ip].filter(t => now - t < 60000); // 60 seconds window
    ipRequestCount[ip].push(now);
    if (ipRequestCount[ip].length > 20) { // 20 requests per minute
        banIP(ip);
        return false;
    }
    return true;
}

// ========== 29 HARDCODED KEYS ==========
function initHardcodedKeys() {
    const now = getIndiaDateTime();
    const hc = [
        { key:'BRONX_PREMIUM_V100_01',name:'Premium 01',limit:999999,expiry:'31-12-2028',scopes:['*'] },
        { key:'BRONX_PREMIUM_V100_02',name:'Premium 02',limit:999999,expiry:'31-12-2028',scopes:['*'] },
        { key:'BRONX_PREMIUM_V100_03',name:'Premium 03',limit:999999,expiry:'31-12-2028',scopes:['*'] },
        { key:'BRONX_PREMIUM_V100_04',name:'Premium 04',limit:999999,expiry:'31-12-2028',scopes:['*'] },
        { key:'BRONX_PREMIUM_V100_05',name:'Premium 05',limit:999999,expiry:'31-12-2028',scopes:['*'] },
        { key:'BRONX_ULTRA_OSINT_01',name:'Ultra 01',limit:888888,expiry:'30-06-2029',scopes:['number','aadhar','upi','pan'] },
        { key:'BRONX_ULTRA_OSINT_02',name:'Ultra 02',limit:888888,expiry:'30-06-2029',scopes:['number','aadhar','upi','pan'] },
        { key:'BRONX_ULTRA_OSINT_03',name:'Ultra 03',limit:888888,expiry:'30-06-2029',scopes:['number','aadhar','upi','pan'] },
        { key:'BRONX_ULTRA_OSINT_04',name:'Ultra 04',limit:888888,expiry:'30-06-2029',scopes:['number','aadhar','upi','pan'] },
        { key:'BRONX_ULTRA_OSINT_05',name:'Ultra 05',limit:888888,expiry:'30-06-2029',scopes:['number','aadhar','upi','pan'] },
        { key:'BRONX_KING_OP_V100',name:'King OP',limit:999999,expiry:'31-12-2030',scopes:['*'] },
        { key:'BRONX_VIP_ACCESS_001',name:'VIP 001',limit:500000,expiry:'31-12-2029',scopes:['number','aadhar','name','upi','ifsc','pan','ip'] },
        { key:'BRONX_VIP_ACCESS_002',name:'VIP 002',limit:500000,expiry:'31-12-2029',scopes:['number','aadhar','name','upi','ifsc','pan','ip'] },
        { key:'BRONX_VIP_ACCESS_003',name:'VIP 003',limit:500000,expiry:'31-12-2029',scopes:['number','aadhar','name','upi','ifsc','pan','ip'] },
        { key:'BRONX_PRO_OSINT_X01',name:'Pro X01',limit:750000,expiry:'31-12-2028',scopes:['number','aadhar','vehicle','rc','ff','bgmi','insta','tg'] },
        { key:'BRONX_PRO_OSINT_X02',name:'Pro X02',limit:750000,expiry:'31-12-2028',scopes:['number','aadhar','vehicle','rc','ff','bgmi','insta','tg'] },
        { key:'BRONX_PRO_OSINT_X03',name:'Pro X03',limit:750000,expiry:'31-12-2028',scopes:['number','aadhar','vehicle','rc','ff','bgmi','insta','tg'] },
        { key:'BRONX_ELITE_V100_01',name:'Elite 01',limit:999999,expiry:'31-12-2030',scopes:['*'] },
        { key:'BRONX_ELITE_V100_02',name:'Elite 02',limit:999999,expiry:'31-12-2030',scopes:['*'] },
        { key:'BRONX_ELITE_V100_03',name:'Elite 03',limit:999999,expiry:'31-12-2030',scopes:['*'] },
        { key:'BRONX_MASTER_KEY_01',name:'Master 01',limit:999999,expiry:'31-12-2030',scopes:['number','aadhar','name','imei','calltracer','upi','ifsc','pan'] },
        { key:'BRONX_MASTER_KEY_02',name:'Master 02',limit:999999,expiry:'31-12-2030',scopes:['number','aadhar','name','imei','calltracer','upi','ifsc','pan'] },
        { key:'BRONX_LEGEND_V100_01',name:'Legend 01',limit:999999,expiry:'31-12-2030',scopes:['*'] },
        { key:'BRONX_LEGEND_V100_02',name:'Legend 02',limit:999999,expiry:'31-12-2030',scopes:['*'] },
        { key:'BRONX_TITAN_OSINT_01',name:'Titan 01',limit:999999,expiry:'31-12-2030',scopes:['number','adharfamily','adharration','insta','tg','git','snap'] },
        { key:'BRONX_TITAN_OSINT_02',name:'Titan 02',limit:999999,expiry:'31-12-2030',scopes:['number','adharfamily','adharration','insta','tg','git','snap'] },
        { key:'BRONX_DIVINE_V100_01',name:'Divine 01',limit:999999,expiry:'31-12-2030',scopes:['*'] },
        { key:'BRONX_IMMORTAL_KEY',name:'Immortal',limit:999999,expiry:'31-12-2030',scopes:['*'] },
        { key:'BRONX_GOD_TIER_V100',name:'God Tier',limit:999999,expiry:'31-12-2030',scopes:['*'] },
    ];
    hc.forEach(d => {
        if(!keyStorage[d.key]) keyStorage[d.key]={
            name:d.name,
            scopes:d.scopes,
            type:'hardcoded',
            limit:d.limit,
            used:0,
            cooldown:0,
            expiry:parseExpiryDate(d.expiry),
            expiryStr:d.expiry,
            created:now,
            unlimited:true,
            hidden:true,
            _hardcoded:true
        };
    });
}

function initCustomAPIs() {
    customAPIs = [
        {id:1,name:'Number Info',endpoint:'number-advanced',param:'num',example:'9876543210',visible:true,realAPI:'https://num-tg-info-api.vercel.app/info?number={param}'},
        {id:2,name:'Vehicle RC',endpoint:'rc-details',param:'ca_number',example:'MH02FZ0555',visible:true,realAPI:'https://bronx-rc-api.vercel.app/bronx?ca_number={param}'},
        {id:3,name:'Aadhar',endpoint:'aadhar-verify',param:'aadhar',example:'393933081942',visible:true,realAPI:'https://bronx-king-vip999.vercel.app/api/aadhaar?num={param}'},
        {id:4,name:'Email',endpoint:'email-lookup',param:'mail',example:'user@gmail.com',visible:true,realAPI:'https://bronx-king-mail-opi.vercel.app/mail={param}'},
        {id:5,name:'Telegram',endpoint:'telegram-scan',param:'id',example:'7530266953',visible:true,realAPI:'https://bronx-tg-king-bro.vercel.app/tg?key=BRONXop&query={param}'},
        {id:6,name:'SMS Bomber',endpoint:'sms-bomber',param:'number',example:'1234567890',visible:true,realAPI:'https://bronx-sms-api-ulimate.vercel.app/api/key-bronx-paid-vip?number={param}&counter=10'},
        {id:7,name:'Number Backup',endpoint:'num-op',param:'num',example:'9876543210',visible:true,realAPI:'https://tfqdeadlo-inddataapi.hf.space/search?mobile={param}'},
    ];
}

const endpoints = {
    number:{p:'num',i:'📱',e:'9876543210',d:'Mobile Lookup',c:'phone'},
    aadhar:{p:'num',i:'🆔',e:'393933081942',d:'Aadhaar',c:'phone'},
    leakinfo:{p:'term',i:'🕵️',e:'email@example.com',d:'Leak Info Search',c:'phone'},
    name:{p:'name',i:'🔍',e:'abhiraaj',d:'Name Search',c:'phone'},
    numv2:{p:'num',i:'📱',e:'6205949840',d:'Number v2',c:'phone'},
    adv:{p:'num',i:'📱',e:'9876543210',d:'Advanced Intel',c:'phone'},
    adharfamily:{p:'num',i:'👨‍👩‍👧‍👦',e:'984154610245',d:'Family',c:'phone'},
    adharration:{p:'num',i:'📋',e:'701984830542',d:'Ration Card',c:'phone'},
    imei:{p:'imei',i:'📱',e:'357817383506298',d:'IMEI',c:'phone'},
    calltracer:{p:'num',i:'📞',e:'9876543210',d:'Call Tracer',c:'phone'},
    upi:{p:'upi',i:'💰',e:'example@ybl',d:'UPI',c:'finance'},
    ifsc:{p:'ifsc',i:'🏦',e:'SBIN0001234',d:'IFSC',c:'finance'},
    pan:{p:'pan',i:'📄',e:'AXDPR2606K',d:'PAN',c:'finance'},
    pincode:{p:'pin',i:'📍',e:'110001',d:'Pincode',c:'location'},
    ip:{p:'ip',i:'🌐',e:'8.8.8.8',d:'IP Lookup',c:'location'},
    vehicle:{p:'vehicle',i:'🚗',e:'MH02FZ0555',d:'Vehicle',c:'vehicle'},
    rc:{p:'owner',i:'📋',e:'UP92P2111',d:'RC Owner',c:'vehicle'},
    ff:{p:'uid',i:'🎮',e:'123456789',d:'Free Fire',c:'gaming'},
    bgmi:{p:'uid',i:'🎮',e:'5121439477',d:'BGMI',c:'gaming'},
    insta:{p:'username',i:'📸',e:'cristiano',d:'Instagram',c:'social'},
    git:{p:'username',i:'💻',e:'ftgamer2',d:'GitHub',c:'social'},
    tg:{p:'info',i:'📲',e:'JAUUOWNER',d:'Telegram',c:'social'},
    tgidinfo:{p:'id',i:'📲',e:'7530266953',d:'TG ID Info',c:'social'},
    snap:{p:'username',i:'👻',e:'priyapanchal272',d:'Snapchat',c:'social'},
    pk:{p:'num',i:'🇵🇰',e:'03331234567',d:'Pakistan',c:'pakistan'},
    pkv2:{p:'num',i:'🇵🇰',e:'3359736848',d:'Pakistan v2',c:'pakistan'}
};

// ========== MIDDLEWARE ==========
app.use(express.json({limit:'50mb'}));
app.use(express.urlencoded({extended:true,limit:'50mb'}));
app.set('json spaces',2);

app.use((req,res,next)=>{
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type,x-api-key,x-admin-token');
    if(req.method==='OPTIONS') return res.status(200).end();
    next();
});

app.use((req,res,next)=>{
    req.clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    if(isIPBanned(req.clientIP)) {
        return res.status(403).json({
            error:'🚫 IP BANNED',
            message:'Too many requests detected',
            contact:'@BRONX_ULTRA'
        });
    }
    if(!checkDDoS(req.clientIP)) {
        return res.status(429).json({
            error:'⚠️ RATE LIMITED',
            message:'Max 20 requests per minute',
            retry_after:'60 seconds',
            contact:'@BRONX_ULTRA'
        });
    }
    next();
});

// ========== ROUTES ==========
app.get('/',(req,res)=>{
    try{res.send(renderHome())}catch(e){res.send('BRONX V7 - Blood Edition')}
});

app.get('/docs',(req,res)=>{
    try{res.send(renderDocs())}catch(e){res.send('Docs Error')}
});

app.get('/test',(req,res)=>{
    res.json({
        status:'✅ BRONX V7 BLOOD',
        storage:'RENDER DISK',
        theme:'BLOOD EDITION',
        total_keys:Object.keys(keyStorage).length,
        ddos_protection:'ACTIVE (20 req/min)',
        contact:'@BRONX_ULTRA'
    });
});

app.get('/api/leakinfo',async(req,res)=>{
    try{
        const term = req.query.term || req.query.info;
        if(!term) return res.json({error:'Missing term',contact:'@BRONX_ULTRA'});
        const resp = await axios.get(`${REAL_API_BASE}/leakinfo?key=${REAL_API_KEY}&info=${encodeURIComponent(term)}`,{timeout:30000});
        res.json(sanitizeResponse(resp.data));
    }catch(e){
        res.json({error:'API error',contact:'@BRONX_ULTRA'});
    }
});

app.get('/api/custom/:ep',async(req,res)=>{
    try{
        const api = customAPIs.find(a=>a.endpoint===req.params.ep && a.visible);
        if(!api) return res.json({error:'API not found or hidden',contact:'@BRONX_ULTRA'});
        const key = req.query.key;
        if(!key) return res.json({error:'🔑 API Key required',contact:'@BRONX_ULTRA'});
        const kc = checkKeyValid(key);
        if(!kc.valid) return res.json({error:kc.error,contact:'@BRONX_ULTRA'});
        const sc = checkKeyScope(kc.keyData,'custom');
        if(!sc.valid) return res.json({error:sc.error,contact:'@BRONX_ULTRA'});
        const pv = req.query[api.param] || req.query.number;
        if(!pv) return res.json({error:'Missing parameter: '+api.param,contact:'@BRONX_ULTRA'});
        let url = api.realAPI.replace(/\{param\}/gi, encodeURIComponent(pv));
        const resp = await axios.get(url,{timeout:30000});
        incrementKeyUsage(key);
        logReq(key,'c/'+req.params.ep,pv,'success',req.clientIP);
        res.json(sanitizeResponse(resp.data, kc.keyData));
    }catch(e){
        res.json({error:'API error',contact:'@BRONX_ULTRA'});
    }
});

app.get('/api/key-bronx/:ep',async(req,res)=>{
    try{
        const ep = req.params.ep;
        if(!endpoints[ep]) return res.json({error:'Endpoint not found',contact:'@BRONX_ULTRA'});
        const key = req.query.key;
        if(!key) return res.json({error:'🔑 API Key required',contact:'@BRONX_ULTRA'});
        const kc = checkKeyValid(key);
        if(!kc.valid) return res.json({
            error:kc.error,
            contact:'@BRONX_ULTRA',
            ...(kc.limitReached ? {
                upgrade_message:'💎 UNLIMITED API AVAILABLE',
                dm:'@BRONX_ULTRA for Premium Access'
            } : {})
        });
        const sc = checkKeyScope(kc.keyData,ep);
        if(!sc.valid) return res.json({error:sc.error,contact:'@BRONX_ULTRA'});
        const pv = req.query[endpoints[ep].p];
        if(!pv) return res.json({error:'Missing '+endpoints[ep].p,contact:'@BRONX_ULTRA'});
        const url = `${REAL_API_BASE}/${ep}?key=${REAL_API_KEY}&${endpoints[ep].p}=${encodeURIComponent(pv)}`;
        const resp = await axios.get(url,{timeout:30000});
        incrementKeyUsage(key);
        logReq(key,ep,pv,'success',req.clientIP);
        res.json(sanitizeResponse(resp.data, kc.keyData));
    }catch(e){
        res.json({error:'API error',contact:'@BRONX_ULTRA'});
    }
});

function logReq(key,ep,param,status,ip) {
    requestLogs.push({
        timestamp:getIndiaDateTime(),
        key:key?key.substring(0,8)+'***':'?',
        endpoint:ep,
        param:param?param.substring(0,20):'',
        status,
        ip:ip||'?'
    });
    if(requestLogs.length>500) requestLogs=requestLogs.slice(-500);
    if(requestLogs.length%10===0) scheduleSave();
}

// ========== ADMIN ROUTES ==========
app.get('/admin',(req,res)=>{
    try{
        const token = req.query.token || req.headers['x-admin-token'];
        if(token && isAdminAuth(token)) return res.send(renderAdmin(token));
        res.send(renderLogin());
    }catch(e){
        res.send('Admin Error');
    }
});

app.post('/admin/login',async(req,res)=>{
    const {username,password} = req.body;
    if(username===ADMIN_USERNAME && password===ADMIN_PASSWORD) {
        const token = generateToken();
        adminSessions[token] = {expiresAt:Date.now()+(365*24*60*60*1000),permanent:true};
        permanentTokens[token] = {createdAt:getIndiaDateTime()};
        scheduleSave();
        res.json({
            success:true,
            token,
            message:'🩸 BLOOD ACCESS GRANTED',
            redirect:'/admin?token='+token
        });
    } else {
        res.json({success:false,error:'🩸 INVALID CREDENTIALS'});
    }
});

app.post('/admin/generate-key',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token)) {
        return res.json({error:'Unauthorized'});
    }
    const {keyName,keyOwner,scopes,limit,expiryDate,days,cooldown} = req.body;
    if(!keyName||!keyOwner) return res.json({error:'Missing key name or owner'});
    if(keyStorage[keyName]) return res.json({error:'Key already exists'});
    
    const ks = scopes || ['number'];
    let exp = null, es = expiryDate || 'LIFETIME';
    
    if(days && !isNaN(days)) {
        const d = new Date(getIndiaTime().getTime() + parseInt(days)*24*60*60*1000);
        exp = d;
        es = d.toISOString().split('T')[0].split('-').reverse().join('-');
    } else if(expiryDate && expiryDate!=='LIFETIME') {
        exp = parseExpiryDate(expiryDate);
        es = expiryDate;
    }
    
    const cd = parseInt(cooldown) || 0; // Cooldown in seconds (0 = no cooldown, 60 = 1 minute)
    
    keyStorage[keyName] = {
        name: keyOwner,
        scopes: ks,
        type: 'generated',
        limit: parseInt(limit) || 100,
        used: 0,
        cooldown: cd, // NEW: Cooldown feature
        expiry: exp,
        expiryStr: es,
        created: getIndiaDateTime(),
        unlimited: false,
        hidden: false,
        _hardcoded: false
    };
    
    saveToDisk();
    
    res.json({
        success: true,
        key: keyName,
        scopes: ks,
        limit: parseInt(limit) || 100,
        cooldown: cd + ' seconds',
        expiry: es,
        created: getIndiaDateTime(),
        message: '🩸 KEY GENERATED SUCCESSFULLY'
    });
});

app.post('/admin/push-key',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token)) {
        return res.json({error:'Unauthorized'});
    }
    const {keyName,days} = req.body;
    if(!keyStorage[keyName]) return res.json({error:'Key not found'});
    if(keyStorage[keyName]._hardcoded) return res.json({error:'Cannot push hardcoded keys'});
    
    const d = parseInt(days) || 30;
    const ne = new Date(getIndiaTime().getTime() + d*24*60*60*1000);
    keyStorage[keyName].expiry = ne;
    keyStorage[keyName].expiryStr = ne.toISOString().split('T')[0].split('-').reverse().join('-');
    keyStorage[keyName].used = 0; // Reset usage on push
    
    saveToDisk();
    
    res.json({
        success: true,
        message: `🩸 Key pushed +${d} days! Usage reset.`,
        new_expiry: keyStorage[keyName].expiryStr
    });
});

app.post('/admin/delete-key',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token)) {
        return res.json({error:'Unauthorized'});
    }
    const {keyName} = req.body;
    if(keyName===MASTER_API_KEY || keyStorage[keyName]?._hardcoded) {
        return res.json({error:'Protected key cannot be deleted'});
    }
    delete keyStorage[keyName];
    saveToDisk();
    res.json({success:true,message:'🩸 Key deleted'});
});

app.post('/admin/reset-all',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token)) {
        return res.json({error:'Unauthorized'});
    }
    Object.keys(keyStorage).forEach(k=>{
        if(k!==MASTER_API_KEY && !keyStorage[k]._hardcoded) {
            keyStorage[k].used = 0;
        }
    });
    saveToDisk();
    res.json({success:true,message:'🩸 All usage reset'});
});

app.post('/admin/ban-ip',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token)) {
        return res.json({error:'Unauthorized'});
    }
    const {ip} = req.body;
    if(ip) {
        banIP(ip);
        saveToDisk();
        res.json({success:true,message:'🩸 IP Banned'});
    } else {
        res.json({error:'No IP provided'});
    }
});

app.post('/admin/unban-ip',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token)) {
        return res.json({error:'Unauthorized'});
    }
    const {ip} = req.body;
    if(ip) {
        unbanIP(ip);
        saveToDisk();
        res.json({success:true,message:'🩸 IP Unbanned'});
    } else {
        res.json({error:'No IP provided'});
    }
});

app.post('/admin/clear-logs',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token)) {
        return res.json({error:'Unauthorized'});
    }
    requestLogs = [];
    saveToDisk();
    res.json({success:true,message:'🩸 Logs cleared'});
});

app.post('/admin/add-api',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token)) {
        return res.json({error:'Unauthorized'});
    }
    const {name,endpoint,param,example,realAPI,visible} = req.body;
    if(!name||!endpoint) return res.json({error:'Name and endpoint required'});
    
    const newAPI = {
        id: customAPIs.length + 1,
        name,
        endpoint,
        param: param || 'num',
        example: example || '9876543210',
        visible: visible !== undefined ? visible : true, // NEW: hide/show feature
        realAPI: realAPI || ''
    };
    
    customAPIs.push(newAPI);
    saveToDisk();
    res.json({success:true,message:'🩸 Custom API added',api:newAPI});
});

app.post('/admin/delete-api',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token)) {
        return res.json({error:'Unauthorized'});
    }
    const idx = customAPIs.findIndex(a=>a.id===parseInt(req.body.id));
    if(idx>-1) {
        customAPIs.splice(idx,1);
        saveToDisk();
        res.json({success:true,message:'🩸 API deleted'});
    } else {
        res.json({error:'API not found'});
    }
});

app.post('/admin/toggle-api',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token)) {
        return res.json({error:'Unauthorized'});
    }
    const api = customAPIs.find(a=>a.id===parseInt(req.body.id));
    if(api) {
        api.visible = !api.visible;
        saveToDisk();
        res.json({
            success:true,
            message:`🩸 API ${api.visible?'SHOWN':'HIDDEN'}`,
            visible:api.visible
        });
    } else {
        res.json({error:'API not found'});
    }
});

app.post('/admin/update-scopes',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token)) {
        return res.json({error:'Unauthorized'});
    }
    const {keyName,scopes} = req.body;
    if(!keyStorage[keyName]) return res.json({error:'Key not found'});
    if(keyStorage[keyName]._hardcoded) return res.json({error:'Cannot modify hardcoded keys'});
    keyStorage[keyName].scopes = scopes;
    saveToDisk();
    res.json({success:true,message:'🩸 Scopes updated'});
});

app.post('/admin/update-cooldown',async(req,res)=>{
    if(!isAdminAuth(req.headers['x-admin-token']||req.query.token)) {
        return res.json({error:'Unauthorized'});
    }
    const {keyName,cooldown} = req.body;
    if(!keyStorage[keyName]) return res.json({error:'Key not found'});
    keyStorage[keyName].cooldown = parseInt(cooldown) || 0;
    saveToDisk();
    res.json({
        success:true,
        message:`🩸 Cooldown set to ${cooldown} seconds`,
        cooldown:keyStorage[keyName].cooldown
    });
});

app.use((req,res)=>{
    res.json({
        error:'404 Not Found',
        message:'Endpoint does not exist',
        contact:'@BRONX_ULTRA',
        docs:'/docs'
    });
});

// ========== BLOOD THEME LOGIN PAGE ==========
function renderLogin() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>BRONX V7 | BLOOD ACCESS</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;500;700&display=swap" rel="stylesheet">
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{
            background:#0a0000;
            display:flex;
            justify-content:center;
            align-items:center;
            min-height:100vh;
            font-family:'Rajdhani',sans-serif;
            overflow:hidden;
        }
        .blood-bg{
            position:fixed;
            inset:0;
            pointer-events:none;
            z-index:0;
        }
        .blood-bg .orb{
            position:absolute;
            border-radius:50%;
            filter:blur(100px);
            animation:float 8s infinite;
        }
        .blood-bg .orb:nth-child(1){
            width:500px;height:500px;
            background:rgba(180,0,0,.15);
            top:-15%;left:-10%;
        }
        .blood-bg .orb:nth-child(2){
            width:400px;height:400px;
            background:rgba(139,0,0,.1);
            bottom:-10%;right:-8%;
            animation-delay:3s;
        }
        .blood-bg .orb:nth-child(3){
            width:300px;height:300px;
            background:rgba(200,0,0,.08);
            top:45%;left:55%;
            animation-delay:6s;
        }
        @keyframes float{
            0%,100%{transform:translate(0,0)}
            33%{transform:translate(50px,-30px)}
            66%{transform:translate(-40px,40px)}
        }
        .card{
            background:rgba(10,0,0,.95);
            padding:55px 45px;
            border-radius:28px;
            width:450px;
            position:relative;
            z-index:1;
            backdrop-filter:blur(50px);
            border:1px solid rgba(180,0,0,.2);
            box-shadow:0 0 120px rgba(180,0,0,.1),0 0 200px rgba(139,0,0,.05),inset 0 1px 0 rgba(255,255,255,.02);
        }
        .card::after{
            content:'';
            position:absolute;
            inset:-1px;
            border-radius:28px;
            padding:1px;
            background:linear-gradient(135deg,rgba(180,0,0,.5),rgba(139,0,0,.3),rgba(220,20,60,.4));
            -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
            mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
            -webkit-mask-composite:xor;
            mask-composite:exclude;
            pointer-events:none;
        }
        .card .logo{
            text-align:center;
            font-family:'Orbitron',sans-serif;
            font-size:13px;
            letter-spacing:10px;
            background:linear-gradient(90deg,#8b0000,#dc143c,#ff0000);
            -webkit-background-clip:text;
            -webkit-text-fill-color:transparent;
            margin-bottom:14px;
            font-weight:900;
        }
        .card h2{
            color:#fff;
            text-align:center;
            font-size:32px;
            font-weight:900;
            font-family:'Orbitron',sans-serif;
            letter-spacing:4px;
            margin-bottom:6px;
            text-shadow:0 0 80px rgba(180,0,0,.5);
        }
        .card .sub{
            text-align:center;
            color:#660000;
            font-size:12px;
            letter-spacing:6px;
            margin-bottom:35px;
            text-transform:uppercase;
        }
        .card input{
            width:100%;
            padding:17px 20px;
            background:rgba(20,0,0,.8);
            border:1px solid rgba(180,0,0,.15);
            border-radius:16px;
            color:#fff;
            font-size:15px;
            outline:none;
            font-family:'Rajdhani',sans-serif;
            transition:.4s;
            margin-bottom:16px;
        }
        .card input:focus{
            border-color:#8b0000;
            box-shadow:0 0 50px rgba(180,0,0,.25),0 0 100px rgba(139,0,0,.05);
            background:rgba(30,0,0,.9);
        }
        .card input::placeholder{color:#330000}
        .btn{
            width:100%;
            padding:18px;
            background:linear-gradient(135deg,#8b0000,#dc143c,#ff0000);
            background-size:200% 200%;
            color:#fff;
            border:none;
            border-radius:16px;
            cursor:pointer;
            font-size:16px;
            font-weight:700;
            letter-spacing:5px;
            font-family:'Orbitron',sans-serif;
            transition:.5s;
            animation:glow 3s ease infinite;
        }
        .btn:hover{
            transform:translateY(-3px);
            box-shadow:0 0 80px rgba(220,20,60,.5);
        }
        @keyframes glow{
            0%,100%{background-position:0% 50%}
            50%{background-position:100% 50%}
        }
        .msg{
            color:#ff0000;
            text-align:center;
            margin-top:14px;
            font-size:13px;
            display:none;
            font-weight:600;
        }
        .foot{
            text-align:center;
            margin-top:24px;
            font-size:10px;
            color:#330000;
            letter-spacing:4px;
        }
    </style>
</head>
<body>
    <div class="blood-bg">
        <div class="orb"></div>
        <div class="orb"></div>
        <div class="orb"></div>
    </div>
    <div class="card">
        <div class="logo">🩸 BRONX OSINT V7.0</div>
        <h2>BLOOD ACCESS</h2>
        <p class="sub">Blood Edition · DDoS Protected</p>
        <input type="text" id="u" placeholder="USERNAME">
        <input type="password" id="p" placeholder="PASSWORD">
        <button class="btn" onclick="login()">🩸 AUTHENTICATE</button>
        <p class="msg" id="msg"></p>
        <p class="foot">BRONX V7 · BLOOD THEME</p>
    </div>
    <script>
        async function login(){
            var u=document.getElementById('u').value,
                p=document.getElementById('p').value,
                m=document.getElementById('msg');
            if(!u||!p){
                m.style.display='block';
                m.style.color='#ff4444';
                m.textContent='🩸 Fill all fields';
                return;
            }
            m.style.display='block';
            m.style.color='#dc143c';
            m.textContent='◌ Authenticating...';
            try{
                var r=await fetch('/admin/login',{
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({username:u,password:p})
                });
                var d=await r.json();
                if(d.success){
                    m.style.color='#ff0000';
                    m.textContent='🩸 '+d.message;
                    setTimeout(()=>location.href=d.redirect,500);
                }else{
                    m.style.color='#ff0000';
                    m.textContent='🩸 '+d.error;
                }
            }catch(e){
                m.textContent='🩸 Connection error';
            }
        }
    </script>
</body>
</html>`;
}

// ========== BLOOD THEME ADMIN PANEL ==========
function renderAdmin(token) {
    try {
        const allKeys = Object.entries(keyStorage)
            .filter(([k,d]) => !d._hardcoded && !d.hidden)
            .map(([k,d]) => ({
                key: k,
                name: d.name || '?',
                limit: d.unlimited ? '∞' : d.limit,
                used: d.used || 0,
                left: d.unlimited ? '∞' : Math.max(0,(d.limit||0)-(d.used||0)),
                expiry: d.expiryStr || 'Lifetime',
                isExpired: d.expiry ? isKeyExpired(d.expiry) : false,
                scopes: d.scopes || [],
                cooldown: d.cooldown || 0,
                created: d.created || 'N/A'
            }));
        
        const hcCount = Object.values(keyStorage).filter(k=>k._hardcoded).length;
        const todayReqs = requestLogs.filter(l=>l.timestamp&&l.timestamp.startsWith(getIndiaDate())).length;
        const weekReqs = requestLogs.filter(l=>{
            if(!l.timestamp) return false;
            const d=new Date(l.timestamp);
            return (getIndiaTime()-d) < 7*24*60*60*1000;
        }).length;
        
        const stoken = esc(token);
        
        // Keys Table
        let keysHTML = allKeys.map(k=>{
            let s='ACTIVE', sc='#ff4444';
            if(k.isExpired){s='EXPIRED';sc='#ff0000'}
            else if(k.left==0){s='LIMIT';sc='#ff6666'}
            return `<tr>
                <td><code style="color:#ff4444">${esc(k.key.substring(0,12))}${k.key.length>12?'..':''}</code></td>
                <td>${esc(k.name)}</td>
                <td>${k.limit}</td>
                <td>${k.used}</td>
                <td style="color:${k.left==0?'#ff0000':'#ff4444'}">${k.left}</td>
                <td>${esc(k.expiry)}</td>
                <td>${k.cooldown}s</td>
                <td style="color:#dc143c">${k.scopes.includes('*')?'ALL':k.scopes.slice(0,2).join(',')+(k.scopes.length>2?'..':'')}</td>
                <td style="color:${sc}">${s}</td>
                <td style="text-align:center">
                    <button class="ab a-g" onclick="pushKey('${esc(k.key)}')">⬆ PUSH</button>
                    <button class="ab a-r" onclick="deleteKey('${esc(k.key)}')">✕ DEL</button>
                </td>
            </tr>`;
        }).join('');
        
        // IP Stats
        const ipStats = {};
        requestLogs.forEach(l=>{
            const ip = l.ip || '?';
            ipStats[ip] = (ipStats[ip]||0)+1;
        });
        const ipHTML = Object.entries(ipStats)
            .sort((a,b)=>b[1]-a[1])
            .slice(0,20)
            .map(([ip,c])=>{
                const bd = bannedIPs.includes(ip);
                return `<tr>
                    <td><code>${esc(ip)}</code></td>
                    <td>${c}</td>
                    <td style="color:${bd?'#ff0000':'#ff4444'}">${bd?'🚫 BANNED':'✅ OK'}</td>
                    <td><button class="ab ${bd?'a-g':'a-r'}" onclick="${bd?`unbanIP('${esc(ip)}')`:`banIP('${esc(ip)}')`}">${bd?'UNBAN':'BAN'}</button></td>
                </tr>`;
            }).join('');
        
        // Logs
        const logsHTML = requestLogs.slice(-30).reverse().map(l=>
            `<div class="log-line">
                <span>${(l.timestamp||'').substring(0,16)}</span>
                <span>${l.key||'?'}</span>
                <code>/${l.endpoint||'?'}</code>
                <span class="${l.status==='success'?'sok':'serr'}">${l.status||'?'}</span>
                <span style="color:#660000;font-size:8px">${l.ip||''}</span>
            </div>`
        ).join('') || '<div class="empty">No logs yet</div>';
        
        // Custom APIs
        const apiHTML = customAPIs.map(a=>`
            <tr>
                <td>${a.id}</td>
                <td>${esc(a.name)}</td>
                <td><code>/${esc(a.endpoint)}</code></td>
                <td>${esc(a.param)}</td>
                <td style="color:${a.visible?'#ff4444':'#660000'}">${a.visible?'🩸 VISIBLE':'🔒 HIDDEN'}</td>
                <td>
                    <button class="ab a-g" onclick="toggleAPI(${a.id})">${a.visible?'HIDE':'SHOW'}</button>
                    <button class="ab a-r" onclick="deleteAPI(${a.id})">✕</button>
                </td>
            </tr>
        `).join('');
        
        // Top Keys
        const keyUsage = {};
        requestLogs.forEach(l=>{
            if(l.key&&l.key!=='?') keyUsage[l.key]=(keyUsage[l.key]||0)+1;
        });
        const topKeys = Object.entries(keyUsage)
            .sort((a,b)=>b[1]-a[1])
            .slice(0,10)
            .map(([k,c])=>`<tr><td><code>${esc(k)}</code></td><td>${c}</td></tr>`)
            .join('') || '<tr><td colspan="2">No data</td></tr>';
        
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>BRONX V7 | BLOOD PANEL</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root{
            --bg:#0a0000;
            --sur:rgba(15,0,0,.85);
            --brd:rgba(180,0,0,.15);
            --txt:#ccaaaa;
            --acc:#8b0000;
            --acc2:#dc143c;
            --green:#ff4444;
            --red:#ff0000;
            --yellow:#ff6666;
            --purple:#b22222;
        }
        *{margin:0;padding:0;box-sizing:border-box}
        body{
            background:var(--bg);
            color:var(--txt);
            font-family:'Rajdhani',sans-serif;
            font-size:13px;
            min-height:100vh;
        }
        body::before{
            content:'';
            position:fixed;
            inset:0;
            background:radial-gradient(ellipse at 50% -10%,rgba(180,0,0,.1),transparent 50%),radial-gradient(ellipse at 80% 90%,rgba(220,20,60,.06),transparent 50%);
            pointer-events:none;
            z-index:0;
        }
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-track{background:#0a0000}
        ::-webkit-scrollbar-thumb{background:var(--acc);border-radius:10px}
        
        .top{
            background:rgba(15,0,0,.95);
            border-bottom:1px solid var(--brd);
            padding:14px 24px;
            display:flex;
            justify-content:space-between;
            align-items:center;
            flex-wrap:wrap;
            gap:10px;
            position:sticky;
            top:0;
            z-index:100;
            backdrop-filter:blur(50px);
        }
        .top h1{
            font-family:'Orbitron',sans-serif;
            font-size:14px;
            letter-spacing:6px;
            background:linear-gradient(90deg,var(--acc),var(--acc2),var(--red));
            -webkit-background-clip:text;
            -webkit-text-fill-color:transparent;
            font-weight:900;
        }
        .tb{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
        .tb a{
            background:rgba(180,0,0,.05);
            color:var(--txt);
            border:1px solid var(--brd);
            padding:8px 14px;
            border-radius:10px;
            font-size:10px;
            font-weight:600;
            letter-spacing:1px;
            text-decoration:none;
            transition:.3s;
        }
        .tb a:hover{
            background:rgba(180,0,0,.12);
            border-color:var(--acc);
            box-shadow:0 0 30px rgba(180,0,0,.15);
        }
        
        .container{max-width:1500px;margin:0 auto;padding:20px;position:relative;z-index:1}
        
        .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:18px}
        .stat-card{
            background:var(--sur);
            border:1px solid var(--brd);
            border-radius:16px;
            padding:16px 12px;
            text-align:center;
            backdrop-filter:blur(30px);
            transition:.3s;
        }
        .stat-card:hover{
            border-color:var(--acc);
            box-shadow:0 0 50px rgba(180,0,0,.1);
            transform:translateY(-2px);
        }
        .stat-card .val{
            font-size:26px;
            font-weight:900;
            background:linear-gradient(135deg,var(--acc),var(--acc2));
            -webkit-background-clip:text;
            -webkit-text-fill-color:transparent;
            font-family:'Orbitron',sans-serif;
        }
        .stat-card .lbl{
            font-size:8px;
            color:#660000;
            text-transform:uppercase;
            letter-spacing:3px;
            margin-top:4px;
            font-weight:600;
        }
        
        .tabs{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}
        .tab{
            padding:10px 18px;
            background:var(--sur);
            border:1px solid var(--brd);
            border-radius:10px;
            color:#660000;
            cursor:pointer;
            font-size:11px;
            font-weight:600;
            letter-spacing:1px;
            transition:.3s;
        }
        .tab:hover{border-color:var(--acc2);color:var(--acc2)}
        .tab.on{
            background:rgba(180,0,0,.08);
            border-color:var(--acc);
            color:#fff;
            box-shadow:0 0 40px rgba(180,0,0,.1);
        }
        
        .panel{display:none}
        .panel.on{display:block}
        
        .section{
            background:var(--sur);
            border:1px solid var(--brd);
            border-radius:18px;
            padding:20px;
            margin-bottom:16px;
            backdrop-filter:blur(30px);
        }
        .section h3{
            color:#fff;
            margin-bottom:12px;
            font-size:15px;
            font-weight:700;
            letter-spacing:2px;
            font-family:'Orbitron',sans-serif;
        }
        .section h4{
            color:#660000;
            font-size:11px;
            margin-bottom:8px;
            letter-spacing:2px;
        }
        
        table{width:100%;border-collapse:collapse;font-size:10px}
        th{
            background:rgba(180,0,0,.05);
            color:#660000;
            padding:10px 8px;
            text-align:left;
            font-size:9px;
            letter-spacing:2px;
            font-weight:600;
        }
        td{padding:8px;border-bottom:1px solid rgba(180,0,0,.05)}
        tr:hover td{background:rgba(180,0,0,.02)}
        
        code{color:var(--acc2);font-family:monospace;font-size:9px}
        
        .ab{
            padding:5px 10px;
            font-size:10px;
            border-radius:6px;
            border:1px solid;
            cursor:pointer;
            font-weight:600;
            transition:.3s;
            background:transparent;
            font-family:'Rajdhani',sans-serif;
            margin:1px;
        }
        .a-g{color:var(--green);border-color:rgba(255,68,68,.2)}
        .a-g:hover{background:rgba(255,68,68,.06)}
        .a-r{color:var(--red);border-color:rgba(255,0,0,.2)}
        .a-r:hover{background:rgba(255,0,0,.06)}
        .a-y{color:var(--yellow);border-color:rgba(255,102,102,.2)}
        .a-y:hover{background:rgba(255,102,102,.06)}
        
        .btn-glow{
            padding:12px 28px;
            background:linear-gradient(135deg,var(--acc),#dc143c,var(--acc2));
            background-size:200% 200%;
            color:#fff;
            border:none;
            border-radius:12px;
            font-weight:700;
            font-size:12px;
            cursor:pointer;
            letter-spacing:2px;
            font-family:'Orbitron',sans-serif;
            transition:.3s;
            text-transform:uppercase;
            animation:btnPulse 3s ease infinite;
        }
        .btn-glow:hover{
            transform:translateY(-2px);
            box-shadow:0 0 50px rgba(220,20,60,.4);
        }
        @keyframes btnPulse{
            0%,100%{background-position:0% 50%}
            50%{background-position:100% 50%}
        }
        
        .fgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
        .fgrid label{
            display:block;
            color:#660000;
            font-size:9px;
            text-transform:uppercase;
            letter-spacing:2px;
            margin-bottom:4px;
            font-weight:600;
        }
        .fgrid input,.fgrid select{
            width:100%;
            padding:12px 14px;
            background:rgba(20,0,0,.7);
            border:1px solid var(--brd);
            border-radius:12px;
            color:#fff;
            font-size:12px;
            font-family:'Rajdhani',sans-serif;
            outline:none;
            transition:.3s;
        }
        .fgrid input:focus,.fgrid select:focus{
            border-color:var(--acc);
            box-shadow:0 0 30px rgba(180,0,0,.2);
        }
        
        .log-box{
            max-height:400px;
            overflow:auto;
            background:rgba(20,0,0,.5);
            border:1px solid var(--brd);
            border-radius:12px;
            padding:12px;
            font-family:monospace;
            font-size:9px;
        }
        .log-line{
            display:flex;
            gap:10px;
            padding:3px 0;
            border-bottom:1px solid rgba(180,0,0,.03);
            flex-wrap:wrap;
            color:#660000;
        }
        .log-line span{min-width:60px;font-size:8px}
        .log-line code{color:var(--acc2);font-size:8px}
        .sok{color:var(--green)}
        .serr{color:var(--red)}
        
        .empty{color:#330000;text-align:center;padding:30px}
        
        .scope-box{
            display:flex;
            flex-wrap:wrap;
            gap:6px;
            padding:10px;
            background:rgba(20,0,0,.5);
            border:1px solid var(--brd);
            border-radius:10px;
            max-height:100px;
            overflow:auto;
        }
        .scope-box label{
            cursor:pointer;
            font-size:10px;
            color:#660000;
            display:flex;
            align-items:center;
            gap:4px;
        }
        
        @media(max-width:768px){
            .stats-grid{grid-template-columns:repeat(2,1fr)}
            .fgrid{grid-template-columns:1fr}
        }
    </style>
</head>
<body>
    <div class="top">
        <h1>🩸 BRONX BLOOD V7</h1>
        <div class="tb">
            <span style="color:#660000;font-size:9px;font-family:monospace">${getIndiaDateTime()}</span>
            <a href="/">🏠 HOME</a>
            <a href="/docs">📚 DOCS</a>
            <a href="/admin">🚪 LOGOUT</a>
        </div>
    </div>
    
    <div class="container">
        <!-- STATS -->
        <div class="stats-grid">
            <div class="stat-card"><div class="val">${allKeys.length}</div><div class="lbl">Gen Keys</div></div>
            <div class="stat-card"><div class="val">${hcCount}</div><div class="lbl">Hardcoded</div></div>
            <div class="stat-card"><div class="val">${todayReqs}</div><div class="lbl">Today</div></div>
            <div class="stat-card"><div class="val">${weekReqs}</div><div class="lbl">7 Days</div></div>
            <div class="stat-card"><div class="val">${requestLogs.length}</div><div class="lbl">Total Reqs</div></div>
            <div class="stat-card"><div class="val">${bannedIPs.length}</div><div class="lbl">Banned</div></div>
            <div class="stat-card"><div class="val">${Object.keys(ipStats).length}</div><div class="lbl">Unique IPs</div></div>
        </div>
        
        <!-- TABS -->
        <div class="tabs">
            <div class="tab on" onclick="st('gen')">🩸 GENERATE</div>
            <div class="tab" onclick="st('keys')">🔑 KEYS</div>
            <div class="tab" onclick="st('scopes')">🎯 SCOPES</div>
            <div class="tab" onclick="st('push')">⬆ PUSH KEY</div>
            <div class="tab" onclick="st('cooldown')">⏱ COOLDOWN</div>
            <div class="tab" onclick="st('ips')">🛡 IPs</div>
            <div class="tab" onclick="st('logs')">📜 LOGS</div>
            <div class="tab" onclick="st('topkeys')">📊 TOP KEYS</div>
            <div class="tab" onclick="st('apis')">🔧 APIs</div>
            <div class="tab" onclick="st('addapi')">➕ ADD API</div>
            <div class="tab" onclick="st('settings')">⚙ SETTINGS</div>
        </div>
        
        <!-- GENERATE KEY -->
        <div class="panel on" id="panel-gen">
            <div class="section">
                <h3>🩸 GENERATE NEW KEY</h3>
                <div class="fgrid">
                    <div><label>Key ID</label><input id="gk" placeholder="MY_KEY"></div>
                    <div><label>Owner Name</label><input id="go" placeholder="Client Name"></div>
                    <div><label>Limit</label><input id="gl" value="100" type="number"></div>
                    <div><label>Days Valid</label><input id="gd" value="30" type="number"></div>
                    <div><label>⏱ Cooldown (seconds)</label>
                        <select id="gcd">
                            <option value="0">0 - No Cooldown</option>
                            <option value="60" selected>60 - 1 Minute</option>
                            <option value="120">120 - 2 Minutes</option>
                            <option value="300">300 - 5 Minutes</option>
                            <option value="600">600 - 10 Minutes</option>
                        </select>
                    </div>
                    <div style="grid-column:1/-1">
                        <label>🎯 Scopes</label>
                        <div class="scope-box">
                            <label><input type="checkbox" value="*" id="scope-all" checked onchange="toggleAllScopes()"> 🌟 ALL</label>
                            ${Object.keys(endpoints).map(e=>`<label><input type="checkbox" value="${e}" class="scope-cb"> ${endpoints[e].i} ${e}</label>`).join('')}
                        </div>
                    </div>
                    <div style="grid-column:1/-1">
                        <button class="btn-glow" onclick="gk()" style="width:100%">🩸 GENERATE KEY</button>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- KEYS TABLE -->
        <div class="panel" id="panel-keys">
            <div class="section">
                <h3>🔑 ALL GENERATED KEYS (${allKeys.length})</h3>
                <div style="max-height:450px;overflow:auto">
                    <table>
                        <tr><th>KEY</th><th>OWNER</th><th>LIMIT</th><th>USED</th><th>LEFT</th><th>EXPIRY</th><th>COOLDOWN</th><th>SCOPES</th><th>STATUS</th><th>ACTIONS</th></tr>
                        ${keysHTML}
                    </table>
                </div>
            </div>
        </div>
        
        <!-- SCOPES -->
        <div class="panel" id="panel-scopes">
            <div class="section">
                <h3>🎯 UPDATE KEY SCOPES</h3>
                <div class="fgrid">
                    <div><label>Key Name</label><input id="sk" placeholder="KEY_NAME"></div>
                    <div style="grid-column:1/-1">
                        <label>New Scopes</label>
                        <div class="scope-box">
                            <label><input type="checkbox" value="*" id="scope-all2"> 🌟 ALL</label>
                            ${Object.keys(endpoints).map(e=>`<label><input type="checkbox" value="${e}" class="scope-cb2"> ${endpoints[e].i} ${e}</label>`).join('')}
                        </div>
                    </div>
                    <div style="grid-column:1/-1">
                        <button class="btn-glow" onclick="updateScopes()" style="width:100%;background:linear-gradient(135deg,#b22222,#8b0000)">🎯 UPDATE SCOPES</button>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- PUSH KEY -->
        <div class="panel" id="panel-push">
            <div class="section">
                <h3>⬆ PUSH KEY (Extend + Reset)</h3>
                <div class="fgrid">
                    <div><label>Key Name</label><input id="pk" placeholder="KEY_NAME"></div>
                    <div><label>Days to Add</label><input id="pd" value="30" type="number"></div>
                    <div style="grid-column:1/-1">
                        <button class="btn-glow" onclick="pushK()" style="width:100%;background:linear-gradient(135deg,#ff6666,#ff0000)">⬆ PUSH KEY</button>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- COOLDOWN -->
        <div class="panel" id="panel-cooldown">
            <div class="section">
                <h3>⏱ UPDATE COOLDOWN</h3>
                <div class="fgrid">
                    <div><label>Key Name</label><input id="ck" placeholder="KEY_NAME"></div>
                    <div><label>Cooldown (seconds)</label>
                        <select id="cdv">
                            <option value="0">0 - No Cooldown</option>
                            <option value="60">60 - 1 Minute</option>
                            <option value="120">120 - 2 Minutes</option>
                            <option value="300">300 - 5 Minutes</option>
                        </select>
                    </div>
                    <div style="grid-column:1/-1">
                        <button class="btn-glow" onclick="updateCooldown()" style="width:100%">⏱ UPDATE COOLDOWN</button>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- IP MANAGER -->
        <div class="panel" id="panel-ips">
            <div class="section">
                <h3>🛡 IP MANAGER + DDoS PROTECTION</h3>
                <div style="margin-bottom:10px;display:flex;gap:8px">
                    <input id="bip" placeholder="IP Address..." style="padding:10px;background:rgba(20,0,0,.7);border:1px solid var(--brd);color:#fff;width:220px;font-size:11px;border-radius:10px">
                    <button class="ab a-r" onclick="banIP2()" style="padding:10px 16px">🚫 BAN</button>
                </div>
                <div style="max-height:350px;overflow:auto">
                    <table>
                        <tr><th>IP</th><th>REQUESTS</th><th>STATUS</th><th>ACTION</th></tr>
                        ${ipHTML}
                    </table>
                </div>
            </div>
        </div>
        
        <!-- LOGS -->
        <div class="panel" id="panel-logs">
            <div class="section">
                <h3>📜 REQUEST LOGS (Last 30)</h3>
                <button class="btn-glow" onclick="clearLogs()" style="margin-bottom:10px;padding:8px 16px;font-size:11px">🗑 CLEAR LOGS</button>
                <div class="log-box">${logsHTML}</div>
            </div>
        </div>
        
        <!-- TOP KEYS -->
        <div class="panel" id="panel-topkeys">
            <div class="section">
                <h3>📊 MOST USED KEYS</h3>
                <div style="max-height:350px;overflow:auto">
                    <table><tr><th>KEY</th><th>REQUESTS</th></tr>${topKeys}</table>
                </div>
            </div>
        </div>
        
        <!-- CUSTOM APIs -->
        <div class="panel" id="panel-apis">
            <div class="section">
                <h3>🔧 CUSTOM APIs (${customAPIs.length})</h3>
                <div style="max-height:350px;overflow:auto">
                    <table>
                        <tr><th>ID</th><th>NAME</th><th>ENDPOINT</th><th>PARAM</th><th>STATUS</th><th>TOGGLE/DEL</th></tr>
                        ${apiHTML}
                    </table>
                </div>
            </div>
        </div>
        
        <!-- ADD API -->
        <div class="panel" id="panel-addapi">
            <div class="section">
                <h3>➕ ADD CUSTOM API</h3>
                <div class="fgrid">
                    <div><label>API Name</label><input id="aname" placeholder="My API"></div>
                    <div><label>Endpoint</label><input id="aep" placeholder="my-endpoint"></div>
                    <div><label>Parameter</label><input id="aparam" placeholder="num"></div>
                    <div><label>Example</label><input id="aex" placeholder="9876543210"></div>
                    <div><label>Visible on Dashboard</label>
                        <select id="avis">
                            <option value="true">👁 Visible</option>
                            <option value="false">🔒 Hidden</option>
                        </select>
                    </div>
                    <div style="grid-column:1/-1">
                        <label>Real API URL ({param})</label>
                        <input id="aurl" placeholder="https://api.com?param={param}">
                    </div>
                    <div style="grid-column:1/-1">
                        <button class="btn-glow" onclick="addAPI()" style="width:100%">➕ ADD API</button>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- SETTINGS -->
        <div class="panel" id="panel-settings">
            <div class="section">
                <h3>⚙ SETTINGS</h3>
                <button class="btn-glow" onclick="resetAll()" style="width:100%;margin-bottom:10px">🔄 RESET ALL USAGE</button>
                <button class="ab a-r" onclick="if(confirm('Delete ALL generated keys?'))deleteAllKeys()" style="width:100%;padding:12px;margin-bottom:8px">🗑 DELETE ALL GENERATED KEYS</button>
                <button class="ab a-g" onclick="clearLogs()" style="width:100%;padding:12px">🧹 CLEAR ALL LOGS</button>
            </div>
        </div>
    </div>
    
    <script>
        var TOKEN='${stoken}';
        
        function st(n){
            document.querySelectorAll('.panel').forEach(p=>p.classList.remove('on'));
            document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));
            document.getElementById('panel-'+n).classList.add('on');
            event.target.classList.add('on');
        }
        
        function toggleAllScopes(){
            var cb=document.getElementById('scope-all');
            document.querySelectorAll('.scope-cb').forEach(s=>s.checked=cb.checked);
        }
        
        async function ac(u,b){
            var o={method:b?'POST':'GET',headers:{'Content-Type':'application/json','x-admin-token':TOKEN}};
            if(b)o.body=JSON.stringify(b);
            var r=await fetch(u,o);
            return await r.json();
        }
        
        async function gk(){
            var n=document.getElementById('gk').value.trim(),
                o=document.getElementById('go').value.trim();
            if(!n||!o){alert('Fill all fields');return}
            var scopes=[];
            if(document.getElementById('scope-all').checked)scopes=['*'];
            else document.querySelectorAll('.scope-cb:checked').forEach(c=>scopes.push(c.value));
            if(scopes.length===0){alert('Select at least 1 scope');return}
            var r=await ac('/admin/generate-key',{
                keyName:n,
                keyOwner:o,
                scopes:scopes,
                limit:document.getElementById('gl').value,
                days:parseInt(document.getElementById('gd').value)||30,
                cooldown:parseInt(document.getElementById('gcd').value)||0
            });
            r.success?(alert('🩸 Key Generated: '+n+'\nCooldown: '+r.cooldown+'\nExpiry: '+r.expiry),location.reload()):alert('❌ '+(r.error||'Error'));
        }
        
        async function deleteKey(k){if(confirm('DELETE '+k+'?')){await ac('/admin/delete-key',{keyName:k});location.reload()}}
        
        async function pushKey(k){
            var d=prompt('Days to add?','30');
            if(!d)return;
            var r=await ac('/admin/push-key',{keyName:k,days:parseInt(d)});
            r.success?(alert('🩸 '+r.message),location.reload()):alert('❌ '+(r.error||'Error'));
        }
        
        async function pushK(){
            var k=document.getElementById('pk').value.trim(),
                d=parseInt(document.getElementById('pd').value)||30;
            if(!k){alert('Enter key name');return}
            var r=await ac('/admin/push-key',{keyName:k,days:d});
            r.success?(alert('🩸 '+r.message),location.reload()):alert('❌ '+(r.error||'Error'));
        }
        
        async function updateScopes(){
            var k=document.getElementById('sk').value.trim();
            if(!k){alert('Enter key name');return}
            var scopes=[];
            if(document.getElementById('scope-all2').checked)scopes=['*'];
            else document.querySelectorAll('.scope-cb2:checked').forEach(c=>scopes.push(c.value));
            if(scopes.length===0){alert('Select scopes');return}
            var r=await ac('/admin/update-scopes',{keyName:k,scopes:scopes});
            r.success?(alert('🩸 Scopes Updated'),location.reload()):alert('❌ '+(r.error||'Error'));
        }
        
        async function updateCooldown(){
            var k=document.getElementById('ck').value.trim();
            if(!k){alert('Enter key name');return}
            var r=await ac('/admin/update-cooldown',{keyName:k,cooldown:parseInt(document.getElementById('cdv').value)});
            r.success?(alert('🩸 '+r.message),location.reload()):alert('❌ '+(r.error||'Error'));
        }
        
        async function banIP2(){
            var ip=document.getElementById('bip').value.trim();
            if(!ip){alert('Enter IP');return}
            await ac('/admin/ban-ip',{ip:ip});
            location.reload();
        }
        
        async function banIP(ip){await ac('/admin/ban-ip',{ip:ip});location.reload()}
        async function unbanIP(ip){await ac('/admin/unban-ip',{ip:ip});location.reload()}
        
        async function clearLogs(){
            if(confirm('Clear all logs?')){await ac('/admin/clear-logs');location.reload()}
        }
        
        async function resetAll(){
            if(confirm('Reset ALL usage?')){await ac('/admin/reset-all');alert('🩸 Reset!');location.reload()}
        }
        
        async function deleteAllKeys(){
            var ks=document.querySelectorAll('button');
            ks.forEach(b=>{if(b.textContent==='✕ DEL')b.click()});
            setTimeout(()=>location.reload(),1000);
        }
        
        async function addAPI(){
            var n=document.getElementById('aname').value.trim(),
                e=document.getElementById('aep').value.trim(),
                p=document.getElementById('aparam').value.trim(),
                ex=document.getElementById('aex').value.trim(),
                u=document.getElementById('aurl').value.trim(),
                v=document.getElementById('avis').value==='true';
            if(!n||!e){alert('Fill name & endpoint');return}
            var r=await ac('/admin/add-api',{name:n,endpoint:e,param:p,example:ex,realAPI:u,visible:v});
            r.success?(alert('🩸 API Added!'),location.reload()):alert('❌ Error');
        }
        
        async function deleteAPI(id){
            if(confirm('Delete API #'+id+'?')){await ac('/admin/delete-api',{id:id});location.reload()}
        }
        
        async function toggleAPI(id){
            var r=await ac('/admin/toggle-api',{id:id});
            r.success?(alert('🩸 '+r.message),location.reload()):alert('❌ Error');
        }
    </script>
</body>
</html>`;
    } catch(e) {
        return `<html><body style="background:#0a0000;color:#ff0000;padding:30px"><h1>ERROR</h1><p>${e.message}</p></body></html>`;
    }
}

// ========== DOCS PAGE ==========
function renderDocs() {
    let h='<div class="hero"><h1>🩸 API DOCS V7</h1><p style="color:#660000">Blood Edition · Render Storage · 29 Hardcoded · DDoS Protected</p></div>';
    h+='<div class="st"><div class="sc"><div class="v">'+Object.keys(endpoints).length+'</div><div class="l">ENDPOINTS</div></div></div>';
    
    const cats={};
    Object.entries(endpoints).forEach(([n,e])=>{
        if(!cats[e.c])cats[e.c]=[];
        cats[e.c].push({name:n,...e});
    });
    
    Object.entries(cats).forEach(([c,eps])=>{
        h+=`<div class="cat"><h2>${c}</h2><div class="grid">`;
        eps.forEach(e=>{
            h+=`<div class="card">
                <span class="method">GET</span><b>/${e.name}</b>
                <p>${e.d}</p>
                <code>GET /api/key-bronx/${e.name}?key=KEY&${e.p}=${e.e}</code>
                <pre>{"success":true,"key_info":{"created_date":"...","expiry_date":"...","remaining_requests":"∞"}}</pre>
            </div>`;
        });
        h+='</div></div>';
    });
    
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>BRONX V7 DOCS</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        :root{--bg:#0a0000;--sur:rgba(15,0,0,.75);--brd:rgba(180,0,0,.12);--txt:#ccaaaa;--acc:#8b0000;--acc2:#dc143c;--green:#ff4444}
        *{margin:0;padding:0;box-sizing:border-box}
        body{background:var(--bg);color:var(--txt);font-family:'Rajdhani',sans-serif;font-size:14px;min-height:100vh}
        body::before{content:'';position:fixed;inset:0;background:radial-gradient(ellipse at 50% 0%,rgba(180,0,0,.08),transparent 60%);pointer-events:none;z-index:0}
        .top{background:rgba(15,0,0,.95);border-bottom:1px solid var(--brd);padding:12px 24px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:100;backdrop-filter:blur(50px)}
        .top a{color:var(--txt);text-decoration:none;font-size:11px;font-weight:600}
        .ct{max-width:1100px;margin:0 auto;padding:20px;position:relative;z-index:1}
        .hero{text-align:center;padding:20px}
        .hero h1{font-family:'Orbitron',sans-serif;font-size:28px;background:linear-gradient(90deg,var(--acc),var(--acc2));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .st{display:flex;justify-content:center;gap:16px;margin:20px 0}
        .sc{background:var(--sur);border:1px solid var(--brd);border-radius:14px;padding:16px 24px}
        .sc .v{font-size:28px;font-weight:900;color:var(--acc);font-family:'Orbitron',sans-serif}
        .sc .l{font-size:9px;color:#660000}
        .cat{margin-bottom:24px}
        .cat h2{color:var(--acc);font-size:16px;font-weight:700;margin-bottom:10px;text-transform:uppercase}
        .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}
        .card{background:var(--sur);border:1px solid var(--brd);border-radius:14px;padding:14px}
        .method{background:rgba(220,20,60,.15);color:var(--acc2);padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700}
        .card b{color:#fff;font-size:14px;margin-left:6px}
        .card p{color:#660000;font-size:10px;margin:4px 0}
        code{display:block;background:rgba(20,0,0,.5);color:var(--acc2);padding:6px;border-radius:4px;font-size:9px;margin:6px 0;font-family:monospace}
        pre{background:rgba(255,68,68,.03);color:var(--green);padding:6px;border-radius:4px;font-size:9px;font-family:monospace}
    </style>
</head>
<body>
    <div class="top">
        <a href="/" style="font-family:'Orbitron',sans-serif;background:linear-gradient(90deg,var(--acc),var(--acc2));-webkit-background-clip:text;-webkit-text-fill-color:transparent">BRONX V7</a>
        <a href="/">HOME</a>
        <a href="/admin">ADMIN</a>
    </div>
    <div class="ct">${h}</div>
</body>
</html>`;
}

// ========== HOME PAGE ==========
function renderHome() {
    const vapi = customAPIs.filter(a=>a.visible);
    const tEP = Object.keys(endpoints).length + vapi.length;
    let cards = '';
    
    Object.entries(endpoints).forEach(([n,e])=>{
        cards+=`<div class="ep" onclick="cp('${esc(n)}','${esc(e.p)}','${esc(e.e)}')">
            <span>${e.i}</span><b>/${esc(n)}</b>
            <small>${e.d}</small>
            <code>${e.p}=${e.e}</code>
        </div>`;
    });
    
    vapi.forEach(a=>{
        cards+=`<div class="ep" style="--ac:#dc143c" onclick="ccp('${esc(a.endpoint)}','${esc(a.param)}','${esc(a.example)}')">
            <span>🔧</span><b>/${esc(a.endpoint)}</b>
            <small>Custom</small>
            <code>${a.param}=${a.example||'v'}</code>
        </div>`;
    });
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>BRONX OSINT V7</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        :root{--bg:#0a0000;--sur:rgba(15,0,0,.65);--brd:rgba(180,0,0,.08);--txt:#ccaaaa;--acc:#8b0000;--acc2:#dc143c;--green:#ff4444;--pink:#ff0000}
        *{margin:0;padding:0;box-sizing:border-box}
        body{background:var(--bg);color:var(--txt);font-family:'Rajdhani',sans-serif;overflow-x:hidden;font-size:14px}
        ::selection{background:var(--acc);color:#fff}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:var(--bg)}
        ::-webkit-scrollbar-thumb{background:var(--acc)}
        
        .glow-bg{position:fixed;inset:0;pointer-events:none;z-index:0}
        .glow-orb{position:absolute;border-radius:50%;filter:blur(120px);animation:float 10s infinite}
        .glow-orb:nth-child(1){width:500px;height:500px;background:rgba(180,0,0,.08);top:-15%;left:-10%}
        .glow-orb:nth-child(2){width:400px;height:400px;background:rgba(220,20,60,.05);bottom:-10%;right:-5%;animation-delay:4s}
        .glow-orb:nth-child(3){width:300px;height:300px;background:rgba(255,0,0,.04);top:50%;left:50%;animation-delay:7s}
        @keyframes float{0%,100%{transform:translate(0,0)}33%{transform:translate(60px,-40px)}66%{transform:translate(-40px,60px)}}
        
        nav{position:sticky;top:0;z-index:1000;background:rgba(10,0,0,.95);border-bottom:1px solid var(--brd);padding:12px 24px;display:flex;justify-content:space-between;align-items:center;backdrop-filter:blur(50px)}
        nav .logo{font-family:'Orbitron',sans-serif;font-size:14px;letter-spacing:5px;background:linear-gradient(90deg,var(--acc),var(--acc2),var(--pink));-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:900;animation:logoGlow 3s ease infinite;background-size:200% 200%}
        @keyframes logoGlow{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        nav .badge{background:rgba(255,68,68,.05);color:var(--green);padding:4px 14px;border-radius:20px;font-size:9px;font-weight:700;border:1px solid rgba(255,68,68,.1);animation:pulse 2s infinite}
        @keyframes pulse{0%,100%{box-shadow:0 0 8px rgba(255,68,68,.1)}50%{box-shadow:0 0 20px rgba(255,68,68,.25)}}
        nav a{color:#660000;text-decoration:none;font-size:10px;font-weight:600;letter-spacing:1px;transition:.3s}
        nav a:hover{color:var(--acc2)}
        
        .hero{text-align:center;padding:50px 20px 20px;position:relative;z-index:1}
        .hero h1{font-size:clamp(36px,8vw,64px);font-weight:900;background:linear-gradient(90deg,var(--acc),var(--acc2),var(--pink),var(--green));background-size:300% 100%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:rainbow 4s linear infinite;font-family:'Orbitron',sans-serif}
        @keyframes rainbow{0%{background-position:0% 50%}100%{background-position:300% 50%}}
        
        .container{max-width:1200px;margin:0 auto;padding:0 20px 40px;position:relative;z-index:1}
        .stats{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;padding:16px;margin-bottom:20px;background:rgba(15,0,0,.55);border:1px solid var(--brd);border-radius:16px;backdrop-filter:blur(30px)}
        .stats>div{text-align:center;min-width:65px}
        .stats .val{font-size:24px;font-weight:900;background:linear-gradient(135deg,var(--acc),var(--acc2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-family:'Orbitron',sans-serif}
        .stats .lbl{font-size:7px;color:#660000;text-transform:uppercase;letter-spacing:3px}
        
        .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
        .ep{background:var(--sur);border:1px solid var(--brd);border-radius:14px;padding:16px;cursor:pointer;transition:.3s;border-top:2px solid var(--ac,#8b0000);backdrop-filter:blur(20px)}
        .ep:hover{transform:translateY(-3px);box-shadow:0 20px 50px rgba(0,0,0,.8)}
        .ep span{font-size:20px}
        .ep b{font-size:14px;color:#fff}
        .ep small{font-size:9px;color:#660000;display:block;margin:4px 0 8px}
        .ep code{font-size:8px;color:var(--ac,#8b0000);background:rgba(20,0,0,.6);padding:3px 6px;border-radius:4px;font-family:monospace}
        
        footer{text-align:center;padding:20px;border-top:1px solid var(--brd);position:relative;z-index:1}
        footer .fb{font-size:16px;font-weight:900;background:linear-gradient(90deg,var(--acc),var(--acc2),var(--pink));-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-family:'Orbitron',sans-serif}
        
        @media(max-width:768px){.hero h1{font-size:28px}.grid{grid-template-columns:1fr}}
    </style>
</head>
<body>
    <div class="glow-bg"><div class="glow-orb"></div><div class="glow-orb"></div><div class="glow-orb"></div></div>
    <nav>
        <a href="/" class="logo">🩸 BRONX V7</a>
        <div style="display:flex;gap:12px;align-items:center">
            <a href="/docs">DOCS</a>
            <a href="/admin">ADMIN</a>
            <span class="badge">BLOOD EDITION</span>
        </div>
    </nav>
    <header class="hero">
        <h1>BRONX OSINT V7.0</h1>
        <p style="color:#660000;font-size:12px;letter-spacing:5px;text-transform:uppercase;margin-top:4px">Blood Ultra Prime Suite</p>
    </header>
    <div class="container">
        <div class="stats">
            <div><div class="val">${tEP}</div><div class="lbl">ENDPOINTS</div></div>
            <div><div class="val">29</div><div class="lbl">HARDCODED</div></div>
            <div><div class="val">∞</div><div class="lbl">REQUESTS</div></div>
            <div><div class="val">🛡</div><div class="lbl">DDOS 20/min</div></div>
        </div>
        <div class="grid">${cards}</div>
    </div>
    <footer><p class="fb">🩸 BRONX OSINT V7.0</p></footer>
    <script>
        var eps=${JSON.stringify(endpoints)};
        function cp(n,p,e){navigator.clipboard.writeText(location.origin+'/api/key-bronx/'+n+'?key=KEY&'+p+'='+e)}
        function ccp(n,p,e){navigator.clipboard.writeText(location.origin+'/api/custom/'+n+'?key=KEY&'+p+'='+(e||'v'))}
    </script>
</body>
</html>`;
}

// ========== STARTUP ==========
const PORT = process.env.PORT || 3000;

(async function(){
    initHardcodedKeys();
    if(!loadFromDisk()){
        if(customAPIs.length===0) initCustomAPIs();
    }
    if(!keyStorage[MASTER_API_KEY]) keyStorage[MASTER_API_KEY] = createMasterKey();
    scheduleSave();
    
    app.listen(PORT, ()=>{
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🩸 BRONX OSINT V7.0 BLOOD ONLINE!');
        console.log(`🚀 PORT: ${PORT}`);
        console.log(`💾 Storage: Render Disk`);
        console.log(`🔒 Hardcoded: ${Object.values(keyStorage).filter(k=>k._hardcoded).length}`);
        console.log(`📦 Generated: ${Object.values(keyStorage).filter(k=>!k._hardcoded&&!k.hidden).length}`);
        console.log('🛡 DDoS: 20 req/min | 60s ban');
        console.log('🩸 THEME: BLOOD EDITION');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });
})();

module.exports = app;
