import { STAR_DESCRIPTIONS } from './constants';

export const TOPIC_LABEL = {
  overview: '命格总览',
  personality: '性格',
  love: '感情',
  career: '事业',
  wealth: '财运',
  health: '健康',
  family: '兄弟合伙',
  children: '子女下属',
  move: '迁移外缘',
  friends: '交友贵人',
  home: '田宅财库',
  spirit: '福德心性',
  parents: '父母文书',
} as const;

export type TopicKey = keyof typeof TOPIC_LABEL;

export const TOPIC_PALACE_NAME: Record<TopicKey, string> = {
  overview: '命',
  personality: '命',
  love: '夫妻',
  career: '官禄',
  wealth: '财帛',
  health: '疾厄',
  family: '兄弟',
  children: '子女',
  move: '迁移',
  friends: '交友',
  home: '田宅',
  spirit: '福德',
  parents: '父母',
};

interface StarDbEntry {
  mingGong: string;
  personality: string;
  xiongDi: string;
  fuQi: string;
  ziNv: string;
  caiBo: string;
  jiE: string;
  qianYi: string;
  jiaoYou: string;
  guanLu: string;
  tianZhai: string;
  fuDe: string;
  fuMu: string;
}

const FIELD_BY_TOPIC: Record<TopicKey, keyof StarDbEntry> = {
  overview: 'mingGong',
  personality: 'personality',
  love: 'fuQi',
  career: 'guanLu',
  wealth: 'caiBo',
  health: 'jiE',
  family: 'xiongDi',
  children: 'ziNv',
  move: 'qianYi',
  friends: 'jiaoYou',
  home: 'tianZhai',
  spirit: 'fuDe',
  parents: 'fuMu',
};

const STARS = [
  '紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府',
  '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军',
];

const STAR_CLASSIC: Record<string, string> = {
  紫微: '《骨髓赋》云“紫微为君，以左辅右弼为相”。',
  天机: '《骨髓赋》云“天机为善”。',
  太阳: '古籍以太阳为贵曜，重光明、名声与外放之气。',
  武曲: '古籍以武曲为财曜，重执行、决断与财务纪律。',
  天同: '古籍以天同为福曜，重和气、享受与调和之力。',
  廉贞: '《骨髓赋》云“廉贞为囚”，须以格局与四化定吉凶。',
  天府: '《骨髓赋》云“天府为臣，以禄存为府库”。',
  太阴: '古籍以太阴为富曜，重细腻、积蓄与阴柔之财。',
  贪狼: '古籍以贪狼为桃花欲望之星，重才艺、人缘与变化。',
  巨门: '古籍以巨门为暗曜，重口才、是非与辨析能力。',
  天相: '古籍以天相为印曜，重辅佐、制度与品行。',
  天梁: '《骨髓赋》云“天梁为荫”。',
  七杀: '《骨髓赋》云“七杀为将星，性刚毅果决”。',
  破军: '古籍以破军为耗曜，重破旧、开创与变化。',
};

export const STAR_DB: Record<string, StarDbEntry> = Object.fromEntries(
  STARS.map(star => [star, buildStarEntry(star)]),
) as Record<string, StarDbEntry>;

function buildStarEntry(star: string): StarDbEntry {
  const entry = {} as StarDbEntry;
  for (const topic of Object.keys(TOPIC_LABEL) as TopicKey[]) {
    entry[FIELD_BY_TOPIC[topic]] = buildContent(star, topic);
  }
  return entry;
}

function buildContent(star: string, topic: TopicKey): string {
  const palace = TOPIC_PALACE_NAME[topic];
  const label = TOPIC_LABEL[topic];
  const desc = STAR_DESCRIPTIONS[star];
  const keywords = desc?.keywords ?? '主星特质';
  const nature = desc?.nature ?? '中性';
  const classic = STAR_CLASSIC[star] ?? '参看《紫微斗数全集》《紫微斗数全书》与《骨髓赋》相关星曜论。';

  return [
    '**【一句话定调】**',
    `${star}入${palace}宫，先取“${keywords}”之象，再以庙旺利陷、四化、三方四正及煞吉同会复核${label}。`,
    '',
    '**【核心论断】**',
    `${star}星性质为${nature}，落入${palace}宫时，会把自身的${keywords}带入该宫主管的人生领域。若会左辅右弼、文昌文曲、天魁天钺或化禄化权化科，多主顺势发挥；若遇羊陀火铃、空劫或化忌，则须看破格条件与大限流年。`,
    '',
    '**【命盘依据】**',
    `判断顺序固定为：一看${palace}宫主星，二看该星庙旺利陷，三看本命四化是否落此星，四看三方四正是否成格，五看对宫借星与空宫结构。此口径与本项目 algorithm.ts、sihua.ts、patterns.ts 的排盘与格局判定一致。`,
    '',
    '**【经典出处】**',
    `${classic} 本条为开源知识库的结构化摘要，具体命盘仍须结合十二宫全局复核，不宜孤立断语。`,
  ].join('\n');
}
