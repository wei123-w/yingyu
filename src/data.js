export const MODES = [
  { id: 'quiz', title: '单词对战', short: '快速问答', description: '看释义选单词，在倒计时里连续得分。', icon: '⚔', color: 'blue', kind: '选择题' },
  { id: 'listening', title: '听力挑战', short: '听音辨词', description: '听清单词发音，从选项中选出正确答案。', icon: '◖', color: 'violet', kind: '听力' },
  { id: 'spelling', title: '拼写大赛', short: '拼写冲刺', description: '根据释义和发音输入正确的英文单词。', icon: 'ABC', color: 'orange', kind: '拼写' },
  { id: 'memory', title: '记忆翻牌', short: '词义配对', description: '翻开卡片，把英文单词与中文释义配成一对。', icon: '▧', color: 'green', kind: '记忆' },
];

export const INITIAL_DECKS = [
  { id: 'daily', name: '高中核心词', color: '#448df0', description: '课堂常用核心词汇' },
  { id: 'classroom', name: '课堂必备', color: '#23b898', description: '校园与课堂表达' },
  { id: 'travel', name: '旅行主题', color: '#f39b4a', description: '出行与旅行主题词汇' },
  { id: 'custom', name: '自定义', color: '#936fe8', description: '你的课堂专属词库' },
];

const starter = [
  ['beautiful','/ˈbjuːtɪfəl/','adj.','美丽的；漂亮的','She is a beautiful girl.','daily'],
  ['abandon','/əˈbændən/','v.','放弃；遗弃','Never abandon your dreams.','daily'],
  ['ability','/əˈbɪləti/','n.','能力；才能','Reading improves your language ability.','daily'],
  ['absolutely','/ˌæbsəˈluːtli/','adv.','绝对地；完全地','You are absolutely right.','daily'],
  ['achievement','/əˈtʃiːvmənt/','n.','成就；成绩','Winning the prize was a great achievement.','daily'],
  ['acquire','/əˈkwaɪər/','v.','获得；习得','Children acquire language naturally.','daily'],
  ['active','/ˈæktɪv/','adj.','积极的；活跃的','She takes an active part in class.','daily'],
  ['adapt','/əˈdæpt/','v.','适应；改编','It takes time to adapt to a new school.','daily'],
  ['adventure','/ədˈventʃər/','n.','冒险；奇遇','The trip became a great adventure.','travel'],
  ['advice','/ədˈvaɪs/','n.','建议；忠告','My teacher gave me some useful advice.','classroom'],
  ['ancient','/ˈeɪnʃənt/','adj.','古代的；古老的','We visited an ancient city.','travel'],
  ['anxious','/ˈæŋkʃəs/','adj.','焦虑的；担心的','He felt anxious before the exam.','daily'],
  ['arrive','/əˈraɪv/','v.','到达；抵达','We will arrive at the station at noon.','travel'],
  ['attention','/əˈtenʃən/','n.','注意；关注','Please pay attention to the new words.','classroom'],
  ['beautifully','/ˈbjuːtɪfəli/','adv.','漂亮地；出色地','She sings beautifully.','daily'],
  ['believe','/bɪˈliːv/','v.','相信；认为','I believe you can do it.','daily'],
  ['challenge','/ˈtʃælɪndʒ/','n./v.','挑战；向……挑战','Learning a new skill is a challenge.','daily'],
  ['classmate','/ˈklæsmeɪt/','n.','同班同学','My classmate helped me with the project.','classroom'],
  ['confident','/ˈkɒnfɪdənt/','adj.','自信的；确信的','She feels confident about the test.','daily'],
  ['curious','/ˈkjʊəriəs/','adj.','好奇的','The curious boy asked many questions.','daily'],
  ['delicious','/dɪˈlɪʃəs/','adj.','美味的','The dinner smells delicious.','travel'],
  ['discover','/dɪˈskʌvər/','v.','发现；找到','We discovered a quiet beach.','travel'],
  ['education','/ˌedʒuˈkeɪʃən/','n.','教育；培养','Education opens many doors.','classroom'],
  ['encourage','/ɪnˈkʌrɪdʒ/','v.','鼓励；激励','Our coach encourages every player.','daily'],
  ['environment','/ɪnˈvaɪrənmənt/','n.','环境；周围状况','We should protect the environment.','daily'],
  ['excellent','/ˈeksələnt/','adj.','极好的；优秀的','You did an excellent job today.','classroom'],
  ['experience','/ɪkˈspɪəriəns/','n./v.','经验；经历','Travel gives us new experience.','travel'],
  ['favorite','/ˈfeɪvərɪt/','adj./n.','最喜欢的（人或物）','Blue is my favorite color.','daily'],
  ['friendly','/ˈfrendli/','adj.','友好的；亲切的','The people here are very friendly.','travel'],
  ['journey','/ˈdʒɜːrni/','n.','旅行；行程','The journey took three hours.','travel'],
  ['knowledge','/ˈnɒlɪdʒ/','n.','知识；学问','Books are a source of knowledge.','classroom'],
  ['language','/ˈlæŋɡwɪdʒ/','n.','语言；表达方式','English is an international language.','classroom'],
  ['museum','/mjuˈziːəm/','n.','博物馆','We saw old paintings in the museum.','travel'],
  ['opportunity','/ˌɒpərˈtuːnəti/','n.','机会；时机','This is a good opportunity to learn.','daily'],
  ['patient','/ˈpeɪʃənt/','adj.','有耐心的','A good teacher is patient with students.','classroom'],
  ['protect','/prəˈtekt/','v.','保护；防护','We must protect wild animals.','daily'],
  ['question','/ˈkwestʃən/','n.','问题；疑问','Ask a question if you need help.','classroom'],
  ['remember','/rɪˈmembər/','v.','记得；记住','I remember her name.','daily'],
  ['successful','/səkˈsesfəl/','adj.','成功的','Hard work leads to a successful result.','daily'],
  ['vacation','/veɪˈkeɪʃən/','n.','假期；休假','We are going to the beach on vacation.','travel'],
  ['wonderful','/ˈwʌndərfəl/','adj.','精彩的；令人愉快的','We had a wonderful time together.','daily'],
];

export const INITIAL_WORDS = starter.map(([word, phonetic, part, meaning, example, deckId], index) => ({
  id: `seed-${index + 1}`, word, phonetic, part, meaning, example, deckId, createdAt: new Date(Date.now() - (starter.length - index) * 86400000).toISOString(), updatedAt: new Date().toISOString(),
}));

export const DEMO_PLAYERS = [
  { name: '小明同学', avatar: '🧑🏻‍🎓', score: 2580, accuracy: 98, games: 32 },
  { name: '英语小达人', avatar: '👧🏻', score: 2460, accuracy: 96, games: 28 },
  { name: '学习进步快', avatar: '🧒🏽', score: 2310, accuracy: 93, games: 25 },
  { name: '阳光少年', avatar: '👦🏻', score: 2180, accuracy: 90, games: 22 },
  { name: '加油呀', avatar: '👩🏽‍🎓', score: 2030, accuracy: 88, games: 20 },
  { name: '快乐学习', avatar: '🧑🏼', score: 1890, accuracy: 85, games: 18 },
  { name: 'sunshine', avatar: '👩🏻', score: 1760, accuracy: 82, games: 16 },
  { name: '小鱼', avatar: '🧒🏻', score: 1620, accuracy: 78, games: 14 },
];

export function createId(prefix = 'item') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
