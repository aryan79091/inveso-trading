const express = require('express');
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../db/database');
const router = express.Router();

const TD_KEY  = process.env.TWELVE_DATA_KEY;
const TD_BASE = 'https://api.twelvedata.com';

const NSE_STOCKS = [
  { symbol:'RELIANCE.NS',  tdSymbol:'RELIANCE:NSE',  name:'Reliance Industries Ltd',        exchange:'NSE' },
  { symbol:'TCS.NS',       tdSymbol:'TCS:NSE',        name:'Tata Consultancy Services',      exchange:'NSE' },
  { symbol:'INFY.NS',      tdSymbol:'INFY:NSE',       name:'Infosys Ltd',                    exchange:'NSE' },
  { symbol:'HDFCBANK.NS',  tdSymbol:'HDFCBANK:NSE',   name:'HDFC Bank Ltd',                  exchange:'NSE' },
  { symbol:'ICICIBANK.NS', tdSymbol:'ICICIBANK:NSE',  name:'ICICI Bank Ltd',                 exchange:'NSE' },
  { symbol:'SBIN.NS',      tdSymbol:'SBIN:NSE',       name:'State Bank of India',            exchange:'NSE' },
  { symbol:'HINDUNILVR.NS',tdSymbol:'HINDUNILVR:NSE', name:'Hindustan Unilever Ltd',         exchange:'NSE' },
  { symbol:'BAJFINANCE.NS',tdSymbol:'BAJFINANCE:NSE', name:'Bajaj Finance Ltd',              exchange:'NSE' },
  { symbol:'WIPRO.NS',     tdSymbol:'WIPRO:NSE',      name:'Wipro Ltd',                      exchange:'NSE' },
  { symbol:'HCLTECH.NS',   tdSymbol:'HCLTECH:NSE',    name:'HCL Technologies Ltd',           exchange:'NSE' },
  { symbol:'ASIANPAINT.NS',tdSymbol:'ASIANPAINT:NSE', name:'Asian Paints Ltd',               exchange:'NSE' },
  { symbol:'MARUTI.NS',    tdSymbol:'MARUTI:NSE',     name:'Maruti Suzuki India Ltd',        exchange:'NSE' },
  { symbol:'TATAMOTORS.NS',tdSymbol:'TATAMOTORS:NSE', name:'Tata Motors Ltd',                exchange:'NSE' },
  { symbol:'AXISBANK.NS',  tdSymbol:'AXISBANK:NSE',   name:'Axis Bank Ltd',                  exchange:'NSE' },
  { symbol:'KOTAKBANK.NS', tdSymbol:'KOTAKBANK:NSE',  name:'Kotak Mahindra Bank Ltd',        exchange:'NSE' },
  { symbol:'LT.NS',        tdSymbol:'LT:NSE',         name:'Larsen and Toubro Ltd',          exchange:'NSE' },
  { symbol:'SUNPHARMA.NS', tdSymbol:'SUNPHARMA:NSE',  name:'Sun Pharmaceutical Industries',  exchange:'NSE' },
  { symbol:'TITAN.NS',     tdSymbol:'TITAN:NSE',      name:'Titan Company Ltd',              exchange:'NSE' },
  { symbol:'ULTRACEMCO.NS',tdSymbol:'ULTRACEMCO:NSE', name:'UltraTech Cement Ltd',           exchange:'NSE' },
  { symbol:'NESTLEIND.NS', tdSymbol:'NESTLEIND:NSE',  name:'Nestle India Ltd',               exchange:'NSE' },
  { symbol:'ZOMATO.NS',    tdSymbol:'ZOMATO:NSE',     name:'Zomato Ltd',                     exchange:'NSE' },
  { symbol:'ADANIPORTS.NS',tdSymbol:'ADANIPORTS:NSE', name:'Adani Ports and SEZ',            exchange:'NSE' },
  { symbol:'DRREDDY.NS',   tdSymbol:'DRREDDY:NSE',    name:"Dr Reddy's Laboratories",        exchange:'NSE' },
  { symbol:'CIPLA.NS',     tdSymbol:'CIPLA:NSE',      name:'Cipla Ltd',                      exchange:'NSE' },
  { symbol:'TECHM.NS',     tdSymbol:'TECHM:NSE',      name:'Tech Mahindra Ltd',              exchange:'NSE' },
  { symbol:'TATASTEEL.NS', tdSymbol:'TATASTEEL:NSE',  name:'Tata Steel Ltd',                 exchange:'NSE' },
  { symbol:'COALINDIA.NS', tdSymbol:'COALINDIA:NSE',  name:'Coal India Ltd',                 exchange:'NSE' },
  { symbol:'ONGC.NS',      tdSymbol:'ONGC:NSE',       name:'Oil and Natural Gas Corp',       exchange:'NSE' },
  { symbol:'POWERGRID.NS', tdSymbol:'POWERGRID:NSE',  name:'Power Grid Corporation',         exchange:'NSE' },
  { symbol:'NTPC.NS',      tdSymbol:'NTPC:NSE',       name:'NTPC Ltd',                       exchange:'NSE' },
  { symbol:'HEROMOTOCO.NS',tdSymbol:'HEROMOTOCO:NSE', name:'Hero MotoCorp Ltd',              exchange:'NSE' },
  { symbol:'EICHERMOT.NS', tdSymbol:'EICHERMOT:NSE',  name:'Eicher Motors Ltd',              exchange:'NSE' },
  { symbol:'HINDALCO.NS',  tdSymbol:'HINDALCO:NSE',   name:'Hindalco Industries Ltd',        exchange:'NSE' },
  { symbol:'JSWSTEEL.NS',  tdSymbol:'JSWSTEEL:NSE',   name:'JSW Steel Ltd',                  exchange:'NSE' },
  { symbol:'INDUSINDBK.NS',tdSymbol:'INDUSINDBK:NSE', name:'IndusInd Bank Ltd',              exchange:'NSE' },
  { symbol:'APOLLOHOSP.NS',tdSymbol:'APOLLOHOSP:NSE', name:'Apollo Hospitals Enterprise',    exchange:'NSE' },
  { symbol:'SBILIFE.NS',   tdSymbol:'SBILIFE:NSE',    name:'SBI Life Insurance',             exchange:'NSE' },
  { symbol:'HDFCLIFE.NS',  tdSymbol:'HDFCLIFE:NSE',   name:'HDFC Life Insurance',            exchange:'NSE' },
  { symbol:'BRITANNIA.NS', tdSymbol:'BRITANNIA:NSE',  name:'Britannia Industries Ltd',       exchange:'NSE' },
  { symbol:'BAJAJFINSV.NS',tdSymbol:'BAJAJFINSV:NSE', name:'Bajaj Finserv Ltd',              exchange:'NSE' },
];

const BASE_PRICES = {
  'RELIANCE.NS':2900,'TCS.NS':3800,'INFY.NS':1750,'HDFCBANK.NS':1680,
  'ICICIBANK.NS':1200,'SBIN.NS':780,'HINDUNILVR.NS':2400,'BAJFINANCE.NS':7200,
  'WIPRO.NS':480,'HCLTECH.NS':1580,'ASIANPAINT.NS':2800,'MARUTI.NS':12500,
  'TATAMOTORS.NS':950,'AXISBANK.NS':1180,'KOTAKBANK.NS':1900,'LT.NS':3600,
  'SUNPHARMA.NS':1750,'TITAN.NS':3400,'ULTRACEMCO.NS':11000,'NESTLEIND.NS':2400,
  'ZOMATO.NS':230,'ADANIPORTS.NS':1350,'BAJAJFINSV.NS':1680,'DRREDDY.NS':6200,
  'CIPLA.NS':1500,'TECHM.NS':1650,'TATASTEEL.NS':160,'COALINDIA.NS':450,
  'ONGC.NS':280,'POWERGRID.NS':320,'NTPC.NS':380,'HEROMOTOCO.NS':5200,
  'EICHERMOT.NS':4800,'HINDALCO.NS':680,'JSWSTEEL.NS':950,'INDUSINDBK.NS':1400,
  'APOLLOHOSP.NS':7200,'SBILIFE.NS':1650,'HDFCLIFE.NS':750,'BRITANNIA.NS':5500,
};

function getBase(sym) { return BASE_PRICES[sym]||1000; }
function getMock(sym) {
  const base=getBase(sym), price=parseFloat((base+(Math.random()-0.48)*base*0.02).toFixed(2));
  const change=parseFloat((price-base).toFixed(2));
  return { price, change, changePercent:parseFloat((change/base*100).toFixed(2)),
    open:parseFloat((base*0.999).toFixed(2)), high:parseFloat((price*1.012).toFixed(2)),
    low:parseFloat((price*0.988).toFixed(2)), volume:Math.floor(Math.random()*5000000+500000),
    prevClose:base, pe:parseFloat((15+Math.random()*25).toFixed(1)),
    high52:parseFloat((base*1.35).toFixed(2)), low52:parseFloat((base*0.68).toFixed(2)) };
}
function getTdSym(sym) {
  const s=NSE_STOCKS.find(s=>s.symbol===sym);
  return s?s.tdSymbol:sym.replace('.NS','')+':NSE';
}
function normCDF(x) {
  const a=[0.254829592,-0.284496736,1.421413741,-1.453152027,1.061405429],p=0.3275911;
  const sign=x<0?-1:1,t=1/(1+p*Math.abs(x));
  return 0.5*(1+sign*(1-((((a[4]*t+a[3])*t+a[2])*t+a[1])*t+a[0])*t*Math.exp(-x*x)));
}
function bs(S,K,T,r,sig,type) {
  if(T<=0) return Math.max(type==='CE'?S-K:K-S,0);
  const d1=(Math.log(S/K)+(r+sig*sig/2)*T)/(sig*Math.sqrt(T)),d2=d1-sig*Math.sqrt(T);
  return type==='CE'?S*normCDF(d1)-K*Math.exp(-r*T)*normCDF(d2):K*Math.exp(-r*T)*normCDF(-d2)-S*normCDF(-d1);
}

router.get('/search', authenticateToken, (req,res) => {
  const q=(req.query.q||'').toLowerCase().trim();
  if(q.length<2) return res.status(400).json({success:false,message:'Query too short'});
  const results=NSE_STOCKS.filter(s=>s.symbol.toLowerCase().includes(q)||s.name.toLowerCase().includes(q)).slice(0,12);
  res.json({success:true,data:results});
});

router.get('/quote/:symbol', authenticateToken, async (req,res) => {
  const symbol=req.params.symbol;
  const stock=NSE_STOCKS.find(s=>s.symbol===symbol);
  try {
    const r=await axios.get(`${TD_BASE}/quote`,{params:{symbol:getTdSym(symbol),apikey:TD_KEY},timeout:5000});
    const d=r.data;
    if(d.status==='error'||!d.close) throw new Error('No data');
    res.json({success:true,data:{symbol,name:stock?.name||symbol,price:parseFloat(d.close),change:parseFloat(d.change),changePercent:parseFloat(d.percent_change),open:parseFloat(d.open),high:parseFloat(d.high),low:parseFloat(d.low),volume:parseInt(d.volume||0),prevClose:parseFloat(d.previous_close),marketCap:null,pe:null,high52:parseFloat(d['52_week']?.high||0),low52:parseFloat(d['52_week']?.low||0)}});
  } catch(err) {
    console.log('TD quote fallback:', err.message);
    const m=getMock(symbol);
    res.json({success:true,data:{symbol,name:stock?.name||symbol,...m}});
  }
});

router.get('/history/:symbol', authenticateToken, async (req,res) => {
  const symbol=req.params.symbol, period=req.query.period||'1mo';
  try {
    const imap={'1d':'5min','5d':'15min','1mo':'1day','3mo':'1day','1y':'1week'};
    const omap={'1d':78,'5d':100,'1mo':30,'3mo':90,'1y':52};
    const r=await axios.get(`${TD_BASE}/time_series`,{params:{symbol:getTdSym(symbol),interval:imap[period]||'1day',outputsize:omap[period]||30,apikey:TD_KEY},timeout:8000});
    if(r.data.status==='error'||!r.data.values) throw new Error('No data');
    const candles=r.data.values.reverse().map(c=>({time:Math.floor(new Date(c.datetime).getTime()/1000),open:parseFloat(c.open),high:parseFloat(c.high),low:parseFloat(c.low),close:parseFloat(c.close),volume:parseInt(c.volume||0)}));
    res.json({success:true,data:candles});
  } catch(err) {
    console.log('TD history fallback:', err.message);
    const base=getBase(symbol);
    const pts={'1d':78,'5d':100,'1mo':30,'3mo':90,'1y':52}[period]||30;
    const ms={'1d':5*60000,'5d':15*60000,'1mo':86400000,'3mo':86400000,'1y':7*86400000}[period]||86400000;
    let price=base*0.85; const candles=[];
    for(let i=0;i<pts;i++){const t=Math.floor((Date.now()-(pts-i)*ms)/1000);price=Math.max(price+(Math.random()-0.48)*price*0.022,base*0.3);const o=parseFloat(price.toFixed(2)),c=parseFloat((price+(Math.random()-0.5)*price*0.01).toFixed(2));candles.push({time:t,open:o,high:parseFloat((Math.max(o,c)*1.005).toFixed(2)),low:parseFloat((Math.min(o,c)*0.995).toFixed(2)),close:c,volume:Math.floor(Math.random()*2000000+100000)});}
    res.json({success:true,data:candles});
  }
});

router.get('/options-expiry/:symbol', authenticateToken, (req,res) => {
  const expiries=[],today=new Date();
  for(let w=0;w<10;w++){const d=new Date(today),t=(4-d.getDay()+7)%7||7;d.setDate(d.getDate()+t+w*7);expiries.push(d.toISOString().split('T')[0]);}
  res.json({success:true,data:[...new Set(expiries)].sort()});
});

router.get('/options-chain/:symbol', authenticateToken, async (req,res) => {
  const sym=req.params.symbol,exp=req.query.expiry;
  const LOT={NIFTY:50,BANKNIFTY:15,FINNIFTY:40,'RELIANCE.NS':250,'TCS.NS':175,'INFY.NS':300,'HDFCBANK.NS':550,'ICICIBANK.NS':700,'SBIN.NS':1500};
  const IDX={NIFTY:22000,BANKNIFTY:48000,FINNIFTY:21000};
  let spot=IDX[sym]||getBase(sym);
  if(!IDX[sym]){try{const r=await axios.get(`${TD_BASE}/price`,{params:{symbol:getTdSym(sym),apikey:TD_KEY},timeout:5000});if(r.data.price)spot=parseFloat(r.data.price);}catch(e){}}
  const ls=LOT[sym]||1,step=spot>30000?100:spot>10000?50:spot>3000?25:spot>1000?10:5,atm=Math.round(spot/step)*step;
  const ed=exp?new Date(exp):new Date(Date.now()+7*86400000),T=Math.max((ed-Date.now())/(365*86400000),1/365),sig=sym==='BANKNIFTY'?0.22:sym==='NIFTY'?0.15:0.20;
  const strikes=[];
  for(let i=-10;i<=10;i++){const K=atm+i*step;strikes.push({strike:K,isATM:i===0,CE:{price:+Math.max(bs(spot,K,T,0.065,sig,'CE'),0.05).toFixed(2),OI:Math.floor(Math.random()*800000+50000),volume:Math.floor(Math.random()*150000+5000),change:+((Math.random()*30-15)).toFixed(2),IV:+(sig*100+(Math.random()*5-2.5)).toFixed(1)},PE:{price:+Math.max(bs(spot,K,T,0.065,sig,'PE'),0.05).toFixed(2),OI:Math.floor(Math.random()*800000+50000),volume:Math.floor(Math.random()*150000+5000),change:+((Math.random()*30-15)).toFixed(2),IV:+(sig*100+(Math.random()*5-2.5)).toFixed(1)}});}
  res.json({success:true,data:{symbol:sym,spotPrice:+spot.toFixed(2),expiry:ed.toISOString().split('T')[0],lotSize:ls,strikes}});
});

router.get('/watchlist', authenticateToken, async (req,res) => {
  const [rows]=await pool.query('SELECT * FROM watchlist WHERE user_id=? ORDER BY added_at DESC',[req.user.userId]);
  res.json({success:true,data:rows});
});
router.post('/watchlist', authenticateToken, async (req,res) => {
  const {symbol,companyName,exchange}=req.body;
  if(!symbol) return res.status(400).json({success:false,message:'Symbol required'});
  await pool.query('INSERT IGNORE INTO watchlist (user_id,symbol,company_name,exchange) VALUES (?,?,?,?)',[req.user.userId,symbol,companyName||symbol,exchange||'NSE']);
  res.json({success:true,message:'Added to watchlist'});
});
router.delete('/watchlist/:symbol', authenticateToken, async (req,res) => {
  await pool.query('DELETE FROM watchlist WHERE user_id=? AND symbol=?',[req.user.userId,req.params.symbol]);
  res.json({success:true,message:'Removed'});
});

module.exports = router;
