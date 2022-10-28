const { ButtonBuilder, ButtonStyle } = require('discord.js');
const humanize = require("humanize-duration");
const os = require('os');
const db = require("quick.db");
const request = require("request");
const axios = require('axios');

module.exports = {
  interaction: {
    name: "bot",
    description: "Bot hakkında bilgiler gösterir.",
    options: [],
  },
  interactionOnly: true,
  aliases: ["botstat", "botb", "bot-bilgi", "botbilgi", "i", 'info'],
  category: "Bot",
  memberPermissions: [],
  botPermissions: ["SendMessages", "EmbedLinks", "ReadMessageHistory"],
  nsfw: false,
  cooldown: 60000,
  ownerOnly: false,

  async execute(client, interaction, data) {

    return interaction.reply({ content: "Bu komut Nraphy client'ına özel olarak hazırlanmıştır. Farklı client'larda kullanmak için düzenleme gerekir." });

    await interaction.deferReply();

    try {

      //------------------------------Back End------------------------------//

      //Botun Sahibi
      let sahip = client.users.cache.get(client.settings.owner);

      //Bot Anlık İstatistikleri
      let results = await Promise.all([
        await client.shard.fetchClientValues('guilds.cache.size'),
        await client.shard.broadcastEval(c => c.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)),
        await client.shard.broadcastEval(c => c.voice.adapters.size),
        await client.shard.broadcastEval(c => c.player.queues.size)
      ]);
      let totalGuilds = results[0].reduce((acc, guildCount) => acc + guildCount, 0);
      let totalMembers = results[1].reduce((acc, memberCount) => acc + memberCount, 0);
      let voiceChannels = results[2].reduce((acc, voiceChannelCount) => acc + voiceChannelCount, 0);
      let playerQueues = results[3].reduce((acc, playerQueuesSize) => acc + playerQueuesSize, 0);

      //Oturum İstatistikleri
      let clientData = await client.database.fetchClientData();

      //Kullanılan Komutlar
      let commandUses = {};

      const { getLastDays } = require("../../modules/Functions");
      let days = await getLastDays(14);

      for await (let day of days) {
        let clientDatabyDate = await client.database.fetchClientData(day);

        for (var command in clientDatabyDate.commandUses) {

          //sortable.push({ command: command, uses: clientDatabyDate.commandUses[command] });
          commandUses[command] ?
            commandUses[command] += clientDatabyDate.commandUses[command] :
            commandUses[command] = clientDatabyDate.commandUses[command];
        }
      }

      let sortable = [];
      for (var command in commandUses) {
        sortable.push([command, commandUses[command]]);
      }

      sortable = sortable.sort(function (a, b) {
        return b[1] - a[1];
      }).slice(0, 15);

      let commandUsesList = await sortable.map(([commandName, uses]) => {
        return `**#${sortable.indexOf(sortable.find(qurve => qurve[0] == commandName)) + 1}** - **${client.capitalizeFirstLetter(commandName, "tr")}** • \`${new Intl.NumberFormat().format(uses >= 10 ? Math.floor(uses / 10) * 10 : uses)}+ Kullanım\``;
      });

      //Kullanım/Sistem İstatistikleri
      let userDatas = await client.database.users.find().exec();
      let guildDatas = await client.database.guilds.find().exec();
      let quickDBGuildDatas = await db.fetch(`guilds`);

      let yeniliklerinOkunması = 0;
      let premiumUsers = 0;
      for await (userData of userDatas) {
        if (userData.readDateOfChanges > client.settings.updateDate) yeniliklerinOkunması++;
        if (userData.NraphyPremium && (userData.NraphyPremium > Date.now())) premiumUsers++;
      }

      let linkBlock_guilds = 0;
      let buttonRole_messages = 0;
      let inviteManager_guilds = 0;
      let logger_guilds = 0;
      let autoReply_guilds = 0;
      let autoRole_guilds = 0;
      let memberCounter_guilds = 0;
      let spamProtection_guilds = 0;
      let upperCaseBlock_guilds = 0;
      let warns_users = 0;
      let warns_warns = 0;
      let wordGame_guilds = 0;
      let countingGame_guilds = 0;
      for await (guildData of guildDatas) {

        //Oto-Cevap
        if (guildData.autoReply) autoReply_guilds++;

        //Bağlantı-Engel
        if (guildData.linkBlock?.guild || guildData.linkBlock?.channels.length) linkBlock_guilds++;

        //Buton-Rol
        if (guildData.buttonRole && Object.keys(guildData.buttonRole)?.length)
          for await (message of Object.keys(guildData.buttonRole)) {
            buttonRole_messages++;
          }

        //Log
        if (guildData.logger?.webhook) logger_guilds++;

        //Oto-Rol
        if (guildData.autoRole.channel) autoRole_guilds++;

        //Spam Koruması
        if (guildData.spamProtection?.guild || guildData.spamProtection?.channels.length) spamProtection_guilds++;

        //Büyük Harf Engelleme
        if (guildData.upperCaseBlock?.guild || guildData.upperCaseBlock?.channels.length) upperCaseBlock_guilds++;

        //Uyarılar
        if (guildData.warns && Object.keys(guildData.warns)?.length)
          for await (warnDataId of Object.keys(guildData.warns)) {
            warns_users++;

            let warnData = guildData.warns[warnDataId];
            if (warnData.length) warns_warns += warnData.length;
          }

      }
      for await (guildDataId of Object.keys(quickDBGuildDatas)) {
        let guildData = quickDBGuildDatas[guildDataId];

        //Davet-Sistemi
        if (guildData.inviteManager?.channel) inviteManager_guilds++;

        //Sayaç
        if (guildData.memberCounter) memberCounter_guilds++;

        //Kelime-Oyunu
        if (guildData.wordGame?.channel) wordGame_guilds++;

        //Sayı-Saymaca
        if (guildData.countingGame?.channel) countingGame_guilds++;
      }

      var availableGiveaways = await client.database.giveaways.find().lean().exec()
        .then(g => g.filter(giveaway => !giveaway.ended));
      var availableBetaGiveaways = await client.database.betaGiveaways.find().lean().exec()
        .then(g => g.filter(giveaway => !giveaway.isEnded));

      let yesterdayDate = (await getLastDays(2)).pop();
      let yesterdayData = await client.database.fetchClientData(yesterdayDate);
      let yesterdayGuildCountDifference = totalGuilds - yesterdayData.guildCount;

      //------------------------------Back End------------------------------//

      //------------------------------Embeds------------------------------//

      //Buttonlar
      let destekSunucusuButon = new ButtonBuilder().setLabel('Destek Sunucusu').setURL("https://discord.gg/VppTU9h").setStyle('Link');
      let davetBağlantısıButon = new ButtonBuilder().setLabel('Davet Bağlantısı').setURL(client.settings.invite).setStyle('Link');
      let sponsorButon = new ButtonBuilder().setLabel('Sponsor (gibir.net.tr)').setURL("https://gibir.net.tr/?utm_source=Nraphy&utm_medium=buttons&utm_id=Nraphy").setStyle('Link');

      let mainPageButton = new ButtonBuilder().setLabel('Ana Sayfa').setCustomId("mainPageButton").setStyle('Primary');
      let usageStatsPageButton = new ButtonBuilder().setLabel('Kullanım/Sistem İstatistikleri').setCustomId("usageStatsPageButton").setStyle('Primary');
      let healthCheckPageButton = new ButtonBuilder().setLabel('Durum Kontrol').setCustomId("healthCheckPageButton").setStyle('Primary');//.setDisabled(true);

      if (interaction.user.id !== client.settings.owner) healthCheckPageButton.setStyle('Danger');

      //Ana Sayfa - Embed
      let mainPageEmbed = {
        color: client.settings.embedColors.default,
        author: {
          name: `${client.user.username} • Bot Bilgileri`,
          icon_url: client.settings.icon,
        },
        title: `**»** Tüm komutlara ulaşmak için \`${data.prefix}komutlar\` yazabilirsiniz!`,
        fields: [
          {
            name: '**»** Botun Sahibi',
            value: `**•** **\`${sahip.tag}\`** \`(ID: ${client.settings.owner})\``,
          },
          {
            name: '**»** Bot Anlık İstatistikleri',
            value:
              `**•** Sunucular: \`${totalGuilds} (Düne göre ${(yesterdayGuildCountDifference < 0 ? "" : "+") + yesterdayGuildCountDifference})\`\n` +
              `**•** Kullanıcılar: \`${totalMembers}\``,
          },
          {
            name: '**»** Sistem İstatistikleri',
            value:
              `**•** Uptime: \`${humanize(os.uptime() * 1000, { language: "tr", round: true, largest: 2 })}\`\n` +
              //`**•** Kullanılabilir Bellek: \`${((os.freemem() * (10 ** -6)) / 1024).toFixed(2)} GB\`\n` +
              `**•** Bellek Kullanımı: \`${((os.totalmem() - os.freemem()) / (1024 ** 3)).toFixed(2)} GB/${(os.totalmem() / (1024 ** 3)).toFixed(2)} GB (%${(((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed()})\``
          },
          /*{
            name: '**»** Oturum Süresi',
            value: `**•** \`${humanize(Date.now() - clientData.registeredAt, { language: "tr", round: true, largest: 2 })}\``,
          },*/
          {
            name: '**»** Ping & Uptime',
            value: `**•** \`/shard\``,
          },
        ],
      };


      //Kullanım/Sistem İstatistikleri - Embed
      let usageStatsPageEmbed = {
        color: client.settings.embedColors.default,
        author: {
          name: `${client.user.username} • Bot Bilgileri`,
          icon_url: client.settings.icon,
        },
        title: `**»** Kullanım/Sistem İstatistikleri!`,
        fields: [
          {
            name: '**»** Sistemlerin Kullanım İstatistikleri (Anlık)',
            value:
              `**•** Bağlantı-Engel: \`${linkBlock_guilds} Sunucu\`\n` +
              `**•** Buton-Rol: \`${buttonRole_messages} Mesaj\`\n` +
              `**•** Büyük-Harf-Engel: \`${upperCaseBlock_guilds} Sunucu\`\n` +
              `**•** Davet Sistemi: \`${inviteManager_guilds} Sunucu\`\n` +
              `**•** Çekilişler: \`${availableGiveaways.length + availableBetaGiveaways.length} (${availableBetaGiveaways.length} Beta) (Devam Eden)\`\n` +
              `**•** Galeri: \`${db.all().filter(data => data.ID.startsWith(`Galeri_`)).length} Kanal\`\n` +
              `**•** İsim-Temizleme: \`${Object.keys(db.fetch(`isim-temizle`)).length} Sunucu\`\n` +
              `**•** Log: \`${logger_guilds} Sunucu\`\n` +
              `**•** Oto-Cevap: \`${autoReply_guilds} Sunucu\`\n` +
              `**•** Oto-Rol: \`${autoRole_guilds} Sunucu\`\n` +
              `**•** Sayaç: \`${memberCounter_guilds} Sunucu\`\n` +
              `**•** Spam-Koruması: \`${spamProtection_guilds} Sunucu\`\n` +
              `**•** Uyarılar: \`${warns_users} Kullanıcı, ${warns_warns} Uyarı\`\n` +
              `**•** Kelime-Oyunu: \`${wordGame_guilds} Sunucu\`\n` +
              `**•** Sayı-Saymaca: \`${countingGame_guilds} Sunucu\``,
            inline: true
          },
          {
            name: '**»** Kullanılan Komutlar (14 günlük)',
            value:
              commandUsesList.slice(0, 15).join('\n').substring(0, 950) + `\n` +
              //`Toplam Kullanım: \`${clientData.cmd + clientData.interactionCmd} (${clientData.interactionCmd} Interaction)\`\n` +
              `**Not:** İstatistikler anonimdir`,
            inline: true
          },
          {
            name: '**»** Hatalar (Günlük)',
            value:
              `**•** Tespit Edilen Hatalar: \`${clientData.error}\``
            //`**•** Shard Çökmeleri: \`${clientData.crash}\``
          },
          {
            name: '**»** Müzik Sistemi (Anlık)',
            value:
              `**•** Bulunduğu Sesli Kanallar: \`${voiceChannels}\`\n` +
              `**•** Aktif Müzik Kuyrukları: \`${playerQueues}\``
          },
          {
            name: '**»** Diğer Bilgiler',
            value:
              `**•** Güncelleme Yayınlanma Tarihi: <t:${(client.settings.updateDate / 1000).toFixed(0)}:f> - \`(${humanize(Date.now() - client.settings.updateDate, { language: "tr", round: true, largest: 1 })} önce)\`\n` +
              `**•** Yenilikleri Okuyan Kullanıcılar: \`${yeniliklerinOkunması}\`\n` +
              `**•** Nraphy Premium Kullanıcıları: \`${premiumUsers}\``,
          },
        ],
      };

      //------------------------------Embeds------------------------------//

      interaction.editReply({
        embeds: [mainPageEmbed],
        components: [
          {
            data: { type: 1 },
            components: [
              destekSunucusuButon,
              davetBağlantısıButon,
              sponsorButon
            ]
          },
          {
            data: { type: 1 },
            components: [
              mainPageButton.setDisabled(true),
              usageStatsPageButton.setDisabled(false),
              healthCheckPageButton.setDisabled(false)
            ]
          },
        ]
      });

      const reply = await interaction.fetchReply();
      const filter = i => {
        i.deferUpdate();
        return i.user.id === interaction.user.id && i.message.id === reply.id;
      };

      const collector = reply.createMessageComponentCollector({ filter, time: 900000 });

      collector.on('collect', btn => {

        switch (btn.customId) {
          case "mainPageButton":
            interaction.editReply({
              embeds: [mainPageEmbed],
              components: [
                {
                  data: { type: 1 },
                  components: [destekSunucusuButon, davetBağlantısıButon, sponsorButon]
                },
                {
                  data: { type: 1 },
                  components: [
                    mainPageButton.setDisabled(true),
                    usageStatsPageButton.setDisabled(false),
                    healthCheckPageButton.setDisabled(false)
                  ]
                },
              ]
            });
            break;
          case "usageStatsPageButton":
            interaction.editReply({
              embeds: [usageStatsPageEmbed],
              components: [
                {
                  data: { type: 1 },
                  components: [destekSunucusuButon, davetBağlantısıButon, sponsorButon]
                },
                {
                  data: { type: 1 },
                  components: [
                    mainPageButton.setDisabled(false),
                    usageStatsPageButton.setDisabled(true),
                    healthCheckPageButton.setDisabled(false)
                  ]
                },
              ]
            });
            break;
          case "healthCheckPageButton":

            //---------------Owner Only---------------//
            if (interaction.user.id !== client.settings.owner)
              return interaction.editReply({
                embeds: [
                  {
                    color: client.settings.embedColors.red,
                    description: "🔒 Burası Rauqq abime özeldir!"
                  }
                ],
                components: [
                  {
                    data: { type: 1 },
                    components: [destekSunucusuButon, davetBağlantısıButon, sponsorButon]
                  },
                  {
                    data: { type: 1 },
                    components: [
                      mainPageButton.setDisabled(false),
                      usageStatsPageButton.setDisabled(false),
                      healthCheckPageButton.setDisabled(true)
                    ]
                  },
                ]
              });

            (async () => {

              //TDK - Health Check
              let api_TDK = false;
              await axios.get(`https://sozluk.gov.tr/gts?ara=Merhaba`)
                .then(result => {
                  if (!result || !result.data || result.data.error) api_TDK = false; else api_TDK = true;
                }).catch(error => { api_TDK = false; });

              //The Cat API - Health Check
              let api_TCA = false;
              await axios.get(`https://api.thecatapi.com/v1/images/search`)
                .then(result => {
                  if (!result || !result.data || !result.data[0]?.url) api_TCA = false; else api_TCA = true;
                }).catch(error => { api_TCA = false; });

              //Durum Kontrol - Embed
              let healthCheckPageEmbed = {
                color: client.settings.embedColors.default,
                author: {
                  name: `${client.user.username} • Bot Bilgileri`,
                  icon_url: client.settings.icon,
                },
                title: `**»** Durum Kontrol!`,
                fields: [
                  {
                    name: '**»** API Durumları',
                    value:
                      `**•** TDK: ${api_TDK ? "✅" : "❌"}\n` +
                      `**•** The Cat API: ${api_TCA ? "✅" : "❌"}\n` +
                      `**•** UBilişim: `
                  },
                  {
                    name: '**»** NekoBot API',
                    value:
                      `**•** 144p: \n` +
                      `**•** Captcha: \n` +
                      `**•** Magik: \n` +
                      `**•** Trump: \n` +
                      `**•** Tweet: \n` +
                      `**•** NSFW:`,
                  },
                  {
                    name: '**»** Veri Tabanı Durumları',
                    value:
                      `**•** MongoDB Atlas: \n` +
                      `**•** Quick.db: \n` +
                      `**•** Log (Yerel): `
                  },
                  {
                    name: '**»** Modüller',
                    value:
                      `**•** songlyrics: \n` +
                      `**•** tcmb-doviz: `
                  },
                ],
              };

              interaction.editReply({
                embeds: [healthCheckPageEmbed],
                components: [
                  {
                    data: { type: 1 },
                    components: [destekSunucusuButon, davetBağlantısıButon, sponsorButon]
                  },
                  {
                    data: { type: 1 },
                    components: [
                      mainPageButton.setDisabled(false),
                      usageStatsPageButton.setDisabled(false),
                      healthCheckPageButton.setDisabled(true)
                    ]
                  },
                ]
              });

            })();

            break;

          default:
            client.logger.error("bot komutunda eror ckt");
        }

      });

    } catch (err) {

      console.log(err);

      await interaction.editReply({ content: "Elimde olmayan sebeplerden dolayı verileri alamadım :/" });

    }

  }
};