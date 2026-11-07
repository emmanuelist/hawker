// Anonymous read-only Twitch chat check (no account, no key)
const chans = process.argv.slice(2);
const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
const counts = {}; const samples = []; const t0 = Date.now();
ws.onopen = () => { ws.send('PASS SCHMOOPIIE'); ws.send('NICK justinfan' + Math.floor(Math.random()*90000+10000)); ws.send('JOIN ' + chans.map(c=>'#'+c).join(',')); };
ws.onmessage = (e) => {
  for (const line of String(e.data).split('\r\n')) {
    if (line.startsWith('PING')) ws.send('PONG :tmi.twitch.tv');
    const m = line.match(/^:(\w+)!\S+ PRIVMSG #(\w+) :(.*)$/);
    if (m) { counts[m[2]] = (counts[m[2]]||0)+1; if (samples.length < 6) samples.push(`[${((Date.now()-t0)/1000).toFixed(1)}s] #${m[2]} ${m[1]}: ${m[3].slice(0,80)}`); }
  }
};
setTimeout(() => { console.log(JSON.stringify({seconds: 20, counts}, null, 1)); console.log(samples.join('\n')); process.exit(0); }, 20000);
