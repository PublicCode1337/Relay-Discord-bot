# Relay-Discord-bot

Wir verwenden auf unserem Discord einen selbstentwickelten Bot um uns vor Problemen mit den Discord ToS zu schützen. Insbesondere in der ⁠hall-of-graf und ⁠hall-of-fame werden oft Sachen geschrieben, die dafür sorgen könnten, das unsere Accounts eingeschränkt oder sogar direkt gesperrt werden. 

Um solche Probleme vorzubeugen haben wir den @RelayBot entwickelt. Der RelayBot nimmt sich alle Nachrichten die in **⁠hall-of-fame** und ⁠**hall-of-graf** gesendet werden und repostet die original Nachricht mithilfe eines Webhooks neu, löscht die Original Nachricht des Users und den Webhook. Das ermöglich uns es das wir fast alles schreiben können was wir wollen ohne das unsere Discord Accounts in Mitleidenschaft gezogen werden. 

Wir empfinden es als sehr wichtig das jeder User auf Discord seine Meinung frei äußern kann, auch eventuell mal in einem etwas böserem Ton ohne direkt Probleme mit Discord zu bekommen. Daher haben wir uns entschlossen, den Bot freizugeben für jeden der ihn braucht für seinen eigenen Server.
Hier ist die ``bot.js`` Datei. Hier müsst ihr nicht viel tun außer die Variable allowedChannelIds abzuändern mit den Channel IDs wo ihr wollt das der Bot dort arbeitet.
Die ``package.json`` macht ihr einfach mit in den Ordner. Wenn ihr später ```npm install``` ausführt, könnt ihr ganz einfach direkt alle benötigen Pakete installieren.

In die ``.env`` macht ihr bitte euren **Discord Bot Token** und die **ID** von eurem Discord Bot. All diese Informationen findet ihr im [Discord Developer Portal](https://discord.com/developers)
