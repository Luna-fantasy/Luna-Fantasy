import type { ArchiveKind } from './archive-carousel-model';

type ExchangeLayers = { incoming: HTMLElement; outgoing: HTMLElement; light: HTMLElement };

const durations = { luna: 680, grand: 790, faction: 640 } as const;
const transform = (x: number, y: number, z: number, yaw: number, roll: number, scale = 1) =>
  `translate3d(${x}px,${y}px,${z}px) rotateY(${yaw}deg) rotateZ(${roll}deg) scale(${scale})`;
const rest = transform(0, 0, 0, 0, 0);
const curve = 'cubic-bezier(.2,.68,.23,1)';

export function readerDragTransform(dx: number, width: number) {
  const progress = Math.max(-1, Math.min(1, dx / Math.max(1, width)));
  return transform(dx * .72, -Math.abs(progress) * 14, 10 + Math.abs(progress) * 18, progress * 15, progress * 7, 1 + Math.abs(progress) * .027);
}

export function playReaderExchange(kind: ArchiveKind, direction: number, layers: ExchangeLayers, start: string) {
  const { incoming, outgoing, light } = layers;
  const width = Math.min(510, Math.max(130, outgoing.offsetWidth));
  const height = Math.min(720, Math.max(180, outgoing.offsetHeight));
  const pose = (across: number, down: number, depth: number, yaw: number, roll: number, scale = 1) =>
    transform(direction * width * across, height * down, depth, direction * yaw, direction * roll, scale);
  const fade = (offset: number, transform: string, opacity = 1): Keyframe => ({ offset, transform, opacity, easing: curve });
  let leave: Keyframe[], arrive: Keyframe[];
  if (kind === 'grand') {
    leave = [fade(0,start),fade(.18,pose(-.045,-.025,30,-10,-1.4)),fade(.61,pose(-.31,-.09,-37,-68,-3.6),.79),fade(1,pose(-.43,-.12,-112,-90,-4),0)];
    arrive = [fade(0,pose(.41,.1,-84,73,2.4),.12),fade(.30,pose(.31,.073,-46,48,1.6),.55),fade(.74,pose(-.024,-.009,13,-5,-.6)),fade(1,rest)];
  } else if (kind === 'faction') {
    leave = [fade(0,start),fade(.15,pose(-.048,0,9,-5,-.7)),fade(.64,pose(-.56,.019,-28,-31,-4.5),.6),fade(1,pose(-.79,.033,-45,-40,-6),0)];
    arrive = [fade(0,pose(.68,-.04,-54,26,3),.25),fade(.36,pose(.37,-.025,-16,13,1.7),.86),fade(.73,pose(-.037,.005,14,-3,-.45)),fade(.90,pose(.013,0,2,1,0)),fade(1,rest)];
  } else {
    leave = [fade(0,start),fade(.22,pose(-.075,-.055,39,-7,-4.5)),fade(.66,pose(-.44,.065,15,-19,-15),.72),fade(1,pose(-.73,.21,-53,-27,-22,.88),0)];
    arrive = [fade(0,pose(.43,.18,-82,22,13,.86),.29),fade(.27,pose(.32,.10,-30,15,8,.94),.78),fade(.68,pose(-.016,-.026,20,-3,-1.3,1.018)),fade(.87,pose(.008,.005,2,.6,.45)),fade(1,rest)];
  }
  const duration = durations[kind];
  const out = outgoing.animate(leave,{duration,fill:'both'});
  const enter = incoming.animate(arrive,{duration,fill:'both'});
  const gleam = light.animate([
    { offset:0, opacity:0, backgroundPosition:'110% 50%' },
    { offset:.29, opacity:.16, backgroundPosition:'100% 50%' },
    { offset:.53, opacity:.74, backgroundPosition:'50% 50%' },
    { offset:.80, opacity:.12, backgroundPosition:'8% 50%' },
    { offset:1, opacity:0, backgroundPosition:'0% 50%' },
  ],{duration,easing:'ease-in-out',fill:'both',direction:direction<0?'reverse':'normal'});
  return { duration, animations:[out,enter,gleam], finished:Promise.all([out.finished,enter.finished,gleam.finished]) };
}
