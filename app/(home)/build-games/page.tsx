import svgPaths from "./svg-paths";
import clsx from "clsx";
import "./styles.css";

// Image imports - these will be placed in public/build-games/assets/
const imgBackground3R11 = "/build-games/assets/background3-r1-1.png";
const imgBackground3R1Square1 = "/build-games/assets/background3-r1-square-1.png";
const imgDirection2R21 = "/build-games/assets/direction2-r2-1.png";
const imgFrame23 = "/build-games/assets/frame-23.png";
const imgFrame27 = "/build-games/assets/frame-27.png";

function BackgroundImage11({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="gradient-border-card relative shrink-0 basis-0 grow rounded-[16px]">
      <BackgroundImage />
      <div className="content-stretch flex flex-col gap-[10px] items-start overflow-clip p-[24px] relative rounded-[inherit]">{children}</div>
    </div>
  );
}

function BackgroundImage10({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="overflow-clip rounded-[inherit] size-full">
      <div className="content-stretch flex flex-col gap-[10px] items-start p-[24px] relative size-full">{children}</div>
    </div>
  );
}

function BackgroundImage9({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="basis-0 flex flex-row grow items-center self-stretch shrink-0">
      <div className="gradient-border-card basis-0 grow h-full min-h-px min-w-px relative rounded-[16px] shrink-0">{children}</div>
    </div>
  );
}
type BackgroundImage8Props = {
  additionalClassNames?: string;
};

function BackgroundImage8({ children, additionalClassNames = "" }: React.PropsWithChildren<BackgroundImage8Props>) {
  return (
    <div className={clsx("content-stretch flex flex-col items-start relative shrink-0 w-full", additionalClassNames)}>
      <div className="content-stretch flex gap-[10px] items-center relative shrink-0 w-[1068px]">{children}</div>
    </div>
  );
}

function BackgroundImage7({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="basis-0 content-stretch flex flex-col grow items-start min-h-px min-w-px overflow-clip relative shrink-0">
      <div className="gap-[10px] grid grid-cols-[repeat(3,_minmax(0px,_1fr))] grid-rows-[repeat(2,_fit-content(100%))] relative shrink-0 w-full">{children}</div>
    </div>
  );
}

function BackgroundImage6({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="relative shrink-0 w-full">
      <div className="content-stretch flex items-start pb-[24px] pt-0 px-[24px] relative w-full">{children}</div>
    </div>
  );
}

function BackgroundImage5({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="gradient-border-card basis-0 grow h-full min-h-px min-w-px relative shrink-0 rounded-[16px]">
      <BackgroundImage />
      <div className="overflow-clip rounded-[inherit] size-full">{children}</div>
    </div>
  );
}

function BackgroundImage4({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="content-stretch flex flex-col items-start overflow-clip relative shrink-0 w-full">
      <div className="content-stretch flex gap-[24px] items-center relative shrink-0 w-full">{children}</div>
    </div>
  );
}

function Group1BackgroundImage7({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="flex flex-row items-center self-stretch">
      <div className="content-stretch flex flex-col h-full items-start overflow-clip p-[24px] relative rounded-[16px] shrink-0">
        <div className="content-stretch flex items-start px-[24px] py-0 relative shrink-0">{children}</div>
      </div>
    </div>
  );
}
type BackgroundImage3Props = {
  additionalClassNames?: string;
};

function BackgroundImage3({ children, additionalClassNames = "" }: React.PropsWithChildren<BackgroundImage3Props>) {
  return (
    <div className={clsx("relative shrink-0 w-full", additionalClassNames)}>
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center p-[24px] relative w-full">{children}</div>
      </div>
    </div>
  );
}

function Group1BackgroundImage6({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="content-stretch flex flex-col gap-[10px] items-start overflow-clip p-[10px] relative shrink-0 w-[478px]">
      <div className="flex flex-col font-['Aeonik:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[48px] text-white w-[306.049px]">
        <p className="leading-none">{children}</p>
      </div>
    </div>
  );
}

function BackgroundImage2({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="[grid-area:2_/_1] content-stretch flex items-start relative shrink-0 w-[151px]">
      <div className="flex flex-col font-['Aeonik:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[16px] text-nowrap text-white">
        <p className="leading-none">{children}</p>
      </div>
    </div>
  );
}

function BackgroundImage1({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className="basis-0 grow min-h-px min-w-px relative shrink-0">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col gap-[10px] items-start px-[24px] py-[10px] relative w-full">{children}</div>
      </div>
    </div>
  );
}

function Group1BackgroundImage5({ children }: React.PropsWithChildren<{}>) {
  return (
    <BackgroundImage1>
      <div className="font-['Aeonik:Regular',sans-serif] leading-[1.5] min-w-full not-italic relative shrink-0 text-[20px] text-white w-[min-content]">{children}</div>
    </BackgroundImage1>
  );
}
type Group1SvgBackgroundImageProps = {
  additionalClassNames?: string;
};

function Group1SvgBackgroundImage({ children, additionalClassNames = "" }: React.PropsWithChildren<Group1SvgBackgroundImageProps>) {
  return (
    <div className={clsx("absolute overflow-clip rounded-[3.35544e+07px] size-[26px] top-1/2 translate-y-[-50%]", additionalClassNames)}>
      <div className="absolute left-0 size-[26px] top-1/2 translate-y-[-50%]" data-name="Frame">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 26 26">
          <g id="Frame">{children}</g>
        </svg>
      </div>
    </div>
  );
}

function GroupBackgroundImage() {
  return (
    <div className="absolute inset-[10.82%_-11.98%]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 1785.09 818.873">
        <g id="Group">
          <g id="Group_2">
            <path d={svgPaths.p12c8e000} fill="url(#paint0_radial_1_1204)" id="Vector" />
            <path d={svgPaths.p1a597800} fill="url(#paint1_radial_1_1204)" id="Vector_2" />
            <path d={svgPaths.p24b6cc30} fill="url(#paint2_radial_1_1204)" id="Vector_3" />
            <path d={svgPaths.p2fbaaa30} fill="url(#paint3_radial_1_1204)" id="Vector_4" />
            <path d={svgPaths.p13277b00} fill="url(#paint4_linear_1_1204)" id="Vector_5" />
            <g id="Vector_6"></g>
            <path d={svgPaths.p1c6a2000} fill="url(#paint5_radial_1_1204)" id="Vector_7" />
            <path d={svgPaths.p12bae8a0} fill="var(--fill-0, #0B1E30)" id="Vector_8" />
          </g>
          <path d={svgPaths.p2591ff40} fill="url(#paint6_radial_1_1204)" id="Vector_9" />
          <path d={svgPaths.p300dd580} fill="url(#paint7_radial_1_1204)" id="Vector_10" />
          <path d={svgPaths.p351bbc80} fill="var(--fill-0, #0B1E30)" id="Vector_11" />
          <path d={svgPaths.p1a2a9000} fill="var(--fill-0, #0B1E30)" id="Vector_12" />
          <path d={svgPaths.p1fde9000} fill="url(#paint8_radial_1_1204)" id="Vector_13" />
          <path d={svgPaths.p2080d400} fill="var(--fill-0, #0B1E30)" id="Vector_14" />
        </g>
        <defs>
          <radialGradient cx="0" cy="0" gradientTransform="translate(547.628 306.09) scale(153.682 153.682)" gradientUnits="userSpaceOnUse" id="paint0_radial_1_1204" r="1">
            <stop offset="0.32" stopColor="#0D263E" />
            <stop offset="1" stopColor="#0B1E30" />
          </radialGradient>
          <radialGradient cx="0" cy="0" gradientTransform="translate(758.065 539.544) scale(119.106 119.106)" gradientUnits="userSpaceOnUse" id="paint1_radial_1_1204" r="1">
            <stop offset="0.32" stopColor="#0D263E" />
            <stop offset="1" stopColor="#0B1E30" />
          </radialGradient>
          <radialGradient cx="0" cy="0" gradientTransform="translate(1341.19 531.813) scale(108.316 108.316)" gradientUnits="userSpaceOnUse" id="paint2_radial_1_1204" r="1">
            <stop offset="0.32" stopColor="#0D263E" />
            <stop offset="1" stopColor="#0B1E30" />
          </radialGradient>
          <radialGradient cx="0" cy="0" gradientTransform="translate(425.042 513.548) scale(146.971 146.971)" gradientUnits="userSpaceOnUse" id="paint3_radial_1_1204" r="1">
            <stop stopColor="#0B1E30" />
            <stop offset="1" stopColor="#0B1E30" />
          </radialGradient>
          <linearGradient gradientUnits="userSpaceOnUse" id="paint4_linear_1_1204" x1="478.889" x2="492.02" y1="471.891" y2="414.764">
            <stop stopColor="#0D263E" />
            <stop offset="1" stopColor="#0B1E30" stopOpacity="0" />
          </linearGradient>
          <radialGradient cx="0" cy="0" gradientTransform="translate(1123.1 341.262) scale(96.8476 96.8476)" gradientUnits="userSpaceOnUse" id="paint5_radial_1_1204" r="1">
            <stop stopColor="#0D263E" />
            <stop offset="1" stopColor="#0B1E30" />
          </radialGradient>
          <radialGradient cx="0" cy="0" gradientTransform="translate(1025.5 515.756) scale(107.807 107.807)" gradientUnits="userSpaceOnUse" id="paint6_radial_1_1204" r="1">
            <stop offset="0.32" stopColor="#0D263E" />
            <stop offset="1" stopColor="#0B1E30" stopOpacity="0" />
          </radialGradient>
          <radialGradient cx="0" cy="0" gradientTransform="translate(668.521 338.203) scale(100.246 100.246)" gradientUnits="userSpaceOnUse" id="paint7_radial_1_1204" r="1">
            <stop offset="0.32" stopColor="#0D263E" />
            <stop offset="1" stopColor="#0B1E30" />
          </radialGradient>
          <radialGradient cx="0" cy="0" gradientTransform="translate(1263.11 349.331) scale(83.34 83.3399)" gradientUnits="userSpaceOnUse" id="paint8_radial_1_1204" r="1">
            <stop offset="0.32" stopColor="#0D263E" />
            <stop offset="1" stopColor="#0B1E30" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
}
type Group1BackgroundImage4Props = {
  text: string;
  text1: string;
  text2: string;
};

function Group1BackgroundImage4({ text, text1, text2 }: Group1BackgroundImage4Props) {
  return (
    <div className="relative rounded-[8px] shrink-0 size-[75px]">
      <div className="content-stretch flex flex-col items-center justify-center leading-[1.25] not-italic overflow-clip p-[5px] relative rounded-[inherit] size-full text-center text-white">
        <p className="font-['Aeonik:Regular',sans-serif] relative shrink-0 text-[16px] w-[57.146px]">{text}</p>
        <p className="font-['Aeonik:Medium',sans-serif] relative shrink-0 text-[24px] text-nowrap">{text1}</p>
        <p className="font-['Aeonik:Regular',sans-serif] relative shrink-0 text-[12px] w-[57.146px]">{text2}</p>
      </div>
      <div aria-hidden="true" className="absolute border border-[#66acd6] border-solid inset-0 pointer-events-none rounded-[8px]" />
    </div>
  );
}
type Group1BackgroundImage3Props = {
  text: string;
  text1: string;
  text2: string;
};

function Group1BackgroundImage3({ text, text1, text2 }: Group1BackgroundImage3Props) {
  return (
    <div className="basis-0 content-stretch flex flex-col grow items-start min-h-px min-w-px px-0 py-[24px] relative shrink-0">
      <div aria-hidden="true" className="absolute border-[#66acd6] border-[0px_0px_1px] border-solid inset-0 pointer-events-none" />
      <p className="font-['Aeonik:Regular',sans-serif] leading-[1.5] not-italic relative shrink-0 text-[48px] text-white w-full">{text}</p>
      <div className="font-['Aeonik:Regular',sans-serif] leading-[1.5] not-italic relative shrink-0 text-[20px] text-white w-full">
        <p className="mb-0">{text1}</p>
        <p>{text2}</p>
      </div>
    </div>
  );
}
type BackgroundImageAndText2Props = {
  text: string;
};

function BackgroundImageAndText2({ text }: BackgroundImageAndText2Props) {
  return (
    <div className="relative rounded-[100px] shrink-0 size-[50px]">
      <div className="content-stretch flex flex-col items-center justify-center overflow-clip relative rounded-[inherit] size-full">
        <div className="flex flex-col font-['Aeonik:Regular',sans-serif] h-[64.65px] justify-center leading-[0] not-italic relative shrink-0 text-[24px] text-center text-white w-[79.642px]">
          <p className="leading-[1.5]">{text}</p>
        </div>
      </div>
      <div aria-hidden="true" className="absolute border border-[#66acd6] border-solid inset-0 pointer-events-none rounded-[100px]" />
    </div>
  );
}
type Group1BackgroundImage2Props = {
  text: string;
  text1: string;
  text2: string;
};

function Group1BackgroundImage2({ text, text1, text2 }: Group1BackgroundImage2Props) {
  return (
    <BackgroundImage4>
      <BackgroundImageAndText2 text={text} />
      <div className="basis-0 content-stretch flex flex-col grow items-start min-h-px min-w-px px-0 py-[24px] relative shrink-0">
        <div aria-hidden="true" className="absolute border-[#66acd6] border-[0px_0px_1px] border-solid inset-0 pointer-events-none" />
        <p className="font-['Aeonik:Regular',sans-serif] leading-[1.5] not-italic relative shrink-0 text-[48px] text-white w-full">{text1}</p>
        <p className="font-['Aeonik:Regular',sans-serif] leading-[1.5] not-italic relative shrink-0 text-[20px] text-white w-full">{text2}</p>
      </div>
    </BackgroundImage4>
  );
}
type Group1BackgroundImageAndText6Props = {
  text: string;
};

function Group1BackgroundImageAndText6({ text }: Group1BackgroundImageAndText6Props) {
  return (
    <div className="gradient-border-card basis-0 grow h-full min-h-px min-w-px relative rounded-[16px] shrink-0">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col items-start p-[24px] relative size-full">
          <div className="basis-0 grow min-h-px min-w-px relative shrink-0 w-full">
            <div aria-hidden="true" className="absolute border-[#66acd6] border-[0px_0px_0px_4px] border-solid inset-0 pointer-events-none" />
            <div className="content-stretch flex items-start px-[24px] py-0 relative size-full">
              <p className="font-['Aeonik:Regular',sans-serif] leading-[1.25] not-italic relative shrink-0 text-[18px] text-white w-[277.333px]">{text}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
type Group1BackgroundImageAndText5Props = {
  text: string;
  additionalClassNames?: string;
};

function Group1BackgroundImageAndText5({ text, additionalClassNames = "" }: Group1BackgroundImageAndText5Props) {
  return (
    <div className={clsx("h-[32px] relative shrink-0 w-[174px]", additionalClassNames)}>
      <div className="absolute flex flex-col font-['Aeonik:Medium',sans-serif] justify-center leading-[0] left-0 not-italic text-[16px] text-white top-[16px] translate-y-[-50%] w-[174px]">
        <p className="leading-none">{text}</p>
      </div>
    </div>
  );
}
type Group1BackgroundImageAndText4Props = {
  text: string;
  additionalClassNames?: string;
};

function Group1BackgroundImageAndText4({ text, additionalClassNames = "" }: Group1BackgroundImageAndText4Props) {
  return (
    <div className={clsx("h-[19.617px] relative shrink-0 w-[93.233px]", additionalClassNames)}>
      <div className="absolute flex flex-col font-['Aeonik:Medium',sans-serif] h-[19.617px] justify-center leading-[0] left-0 not-italic text-[#66acd6] text-[12px] top-[9.81px] translate-y-[-50%] w-[93.233px]">
        <p className="leading-none">{text}</p>
      </div>
    </div>
  );
}
type Group1BackgroundImageAndText3Props = {
  text: string;
};

function Group1BackgroundImageAndText3({ text }: Group1BackgroundImageAndText3Props) {
  return <BackgroundImage2>{text}</BackgroundImage2>;
}
type Group1BackgroundImageAndText2Props = {
  text: string;
};

function Group1BackgroundImageAndText2({ text }: Group1BackgroundImageAndText2Props) {
  return (
    <div className="[grid-area:1_/_1] content-stretch flex items-start px-0 py-[3px] relative shrink-0 w-[151px]">
      <div className="flex flex-col font-['Aeonik:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#66acd6] text-[12px] text-nowrap">
        <p className="leading-none">{text}</p>
      </div>
    </div>
  );
}
type Group1BackgroundImageAndText1Props = {
  text: string;
};

function Group1BackgroundImageAndText1({ text }: Group1BackgroundImageAndText1Props) {
  return (
    <div className="content-stretch flex flex-col gap-[10px] items-start justify-center overflow-clip p-[10px] relative shrink-0 w-[405px]">
      <div className="flex flex-col font-['Aeonik:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#66acd6] text-[24px] w-[306.049px]">
        <p className="leading-none">{text}</p>
      </div>
    </div>
  );
}
type BackgroundImageAndText1Props = {
  text: string;
  additionalClassNames?: string;
};

function BackgroundImageAndText1({ text, additionalClassNames = "" }: BackgroundImageAndText1Props) {
  return (
    <div className={clsx("content-stretch flex items-start px-0 relative shrink-0 w-full", additionalClassNames)}>
      <p className="font-['Aeonik:Regular',sans-serif] leading-[1.25] not-italic relative shrink-0 text-[18px] text-white w-[211.5px]">{text}</p>
    </div>
  );
}
type BackgroundImageAndTextProps = {
  text: string;
};

function BackgroundImageAndText({ text }: BackgroundImageAndTextProps) {
  return (
    <BackgroundImage5>
      <div className="content-stretch flex flex-col gap-[10px] items-start p-[24px] relative size-full">
        <div className="bg-white shrink-0 size-[42px]" />
        <BackgroundImageAndText1 text={text} additionalClassNames="py-[36px]" />
      </div>
    </BackgroundImage5>
  );
}
type ButtonBackgroundImageAndTextProps = {
  text: string;
  additionalClassNames?: string;
};

function ButtonBackgroundImageAndText({ text, additionalClassNames = "" }: ButtonBackgroundImageAndTextProps) {
  return (
    <div className={clsx("bg-[#66acd6] content-stretch flex h-[36px] items-center justify-center px-[36px] py-[6px] relative rounded-[3.35544e+07px] shrink-0", additionalClassNames)}>
      <div className="flex flex-col font-['Aeonik:Medium',sans-serif] font-medium justify-center leading-[0] relative shrink-0 text-[#152d44] text-[14px] text-center text-nowrap">
        <p className="leading-[20px]">{text}</p>
      </div>
    </div>
  );
}
type Group1BackgroundImage1Props = {
  text: string;
  text1: string;
  additionalClassNames?: string;
};

function Group1BackgroundImage1({ text, text1, additionalClassNames = "" }: Group1BackgroundImage1Props) {
  return (
    <div className={clsx("content-stretch flex items-center px-[24px] relative size-full", additionalClassNames)}>
      <div className="content-stretch flex gap-[10px] items-center relative shrink-0">
        <div className="content-stretch flex flex-col items-center relative shrink-0" data-name="Link">
          <div className="bg-[rgba(40,106,142,0.1)] content-stretch flex h-[36px] items-center justify-center px-[49px] py-[7px] relative rounded-[3.35544e+07px] shrink-0" data-name="Button">
            <div aria-hidden="true" className="absolute border border-[rgba(102,172,214,0.5)] border-solid inset-0 pointer-events-none rounded-[3.35544e+07px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]" />
            <div className="flex flex-col font-['Aeonik:Medium',sans-serif] font-medium justify-center leading-[0] relative shrink-0 text-[#66acd6] text-[14px] text-center text-nowrap">
              <p className="leading-[20px]">{text}</p>
            </div>
          </div>
        </div>
        <ButtonBackgroundImageAndText text={text1} additionalClassNames="shadow-[0px_0px_25px_0px_rgba(46,177,255,0.55)]" />
      </div>
    </div>
  );
}
type Group1BackgroundImageAndTextProps = {
  text: string;
  additionalClassNames?: string;
};

function Group1BackgroundImageAndText({ text, additionalClassNames = "" }: Group1BackgroundImageAndTextProps) {
  return (
    <div className={clsx("content-stretch flex flex-col gap-[10px] p-[10px] relative w-full", additionalClassNames)}>
      <div className="flex flex-col font-['Aeonik:Medium',sans-serif] font-medium justify-center leading-[0] not-italic relative shrink-0 text-[48px] text-nowrap text-white">
        <p className="leading-[72px]">{text}</p>
      </div>
    </div>
  );
}

function BackgroundImage() {
  return (
    <div aria-hidden="true" className="absolute inset-0 pointer-events-none rounded-[16px]">
      <div className="absolute bg-[#0b1e30] inset-0 rounded-[16px]" />
      <img alt="" className="absolute max-w-none object-50%-50% object-cover rounded-[16px] size-full" src={imgFrame23} />
    </div>
  );
}
type Group1BackgroundImageProps = {
  text: string;
  text1: string;
};

function Group1BackgroundImage({ text, text1 }: Group1BackgroundImageProps) {
  return (
    <div className="gradient-border-card basis-0 grow h-full min-h-px min-w-px relative rounded-[16px] shrink-0">
      <BackgroundImage />
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col font-['Aeonik:Medium',sans-serif] items-start justify-between leading-[0] not-italic px-[36px] py-[60px] relative size-full text-white">
          <div className="flex flex-col justify-center relative shrink-0 text-[48px] w-full">
            <p className="leading-[72px]">{text}</p>
          </div>
          <div className="flex flex-col justify-center relative shrink-0 text-[24px] w-full">
            <p className="leading-[37.602px]">{text1}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Group() {
  return (
    <div className="absolute flex flex-col font-['Geist:SemiBold',sans-serif] font-semibold h-[27px] justify-center leading-[0] left-[36px] text-[#f8f8f8] text-[18px] top-[17.5px] translate-y-[-50%] w-[101.296px]">
      <p className="leading-[27px]">Builder Hub</p>
    </div>
  );
}

function Group1() {
  return (
    <div className="absolute content-stretch flex flex-col items-start left-[-0.05px] right-[0.05px] top-[-14px]" data-name="Main">
      <div className="backdrop-blur backdrop-filter bg-[rgba(18,18,18,0.8)] relative shrink-0 w-full" data-name="Nav">
        <div aria-hidden="true" className="absolute border-[#161616] border-[0px_0px_1px] border-solid inset-0 pointer-events-none" />
        <div className="content-stretch flex flex-col items-start px-[16px] py-0 relative w-full">
          <div className="h-[56px] relative shrink-0 w-[1408px]" data-name="Nav">
            <div className="absolute h-[31px] left-[8px] top-1/2 translate-y-[-50%] w-[136.94px]" data-name="Link">
              <div className="absolute left-0 size-[28px] top-1/2 translate-y-[-50%]" data-name="SVG">
                <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 28 28">
                  <g id="SVG">
                    <path d={svgPaths.p3d894d00} fill="var(--fill-0, #010000)" id="Vector" opacity="0" />
                    <path d={svgPaths.p1dd83680} fill="var(--fill-0, #FD3648)" id="Vector_2" />
                    <path d={svgPaths.p1c4fee00} fill="var(--fill-0, #FC3648)" id="Vector_3" />
                  </g>
                </svg>
              </div>
              <Group />
            </div>
            <div className="absolute h-[36px] left-[160.94px] top-1/2 translate-y-[-50%] w-[789.98px]" data-name="List">
              <div className="absolute h-[31.5px] left-[25.59px] rounded-[8px] top-1/2 translate-y-[-50%] w-[76.5px]" data-name="Item → Button → Link">
                <div className="absolute flex flex-col font-['Geist:Regular',sans-serif] font-normal h-[16px] justify-center leading-[0] left-[calc(50%+0.19px)] text-[#737373] text-[14px] text-center top-[15.75px] translate-x-[-50%] translate-y-[-50%] w-[60.886px]">
                  <p className="leading-[20px]">Academy</p>
                </div>
              </div>
              <div className="absolute h-[31.5px] left-[113.28px] rounded-[8px] top-1/2 translate-y-[-50%] w-[45.75px]" data-name="Item → Button → Link">
                <div className="absolute flex flex-col font-['Geist:Regular',sans-serif] font-normal h-[16px] justify-center leading-[0] left-[calc(50%+0.19px)] text-[#737373] text-[14px] text-center top-[15.75px] translate-x-[-50%] translate-y-[-50%] w-[30.13px]">
                  <p className="leading-[20px]">Blog</p>
                </div>
              </div>
              <div className="absolute h-[31.5px] left-[170.22px] rounded-[8px] top-1/2 translate-y-[-50%] w-[69.06px]" data-name="Item → Button → Link">
                <div className="absolute flex flex-col font-['Geist:Regular',sans-serif] font-normal h-[16px] justify-center leading-[0] left-[calc(50%+0.18px)] text-[#737373] text-[14px] text-center top-[15.75px] translate-x-[-50%] translate-y-[-50%] w-[53.423px]">
                  <p className="leading-[20px]">Console</p>
                </div>
              </div>
              <div className="absolute h-[31.5px] left-[250.47px] rounded-[8px] top-1/2 translate-y-[-50%] w-[115.08px]" data-name="Item → Button → Link">
                <div className="absolute flex flex-col font-['Geist:Regular',sans-serif] font-normal h-[16px] justify-center leading-[0] left-[calc(50%+0.18px)] text-[#737373] text-[14px] text-center top-[15.75px] translate-x-[-50%] translate-y-[-50%] w-[99.433px]">
                  <p className="leading-[20px]">Documentation</p>
                </div>
              </div>
              <div className="absolute h-[31.5px] left-[376.73px] rounded-[8px] top-1/2 translate-y-[-50%] w-[59.92px]" data-name="Item → Button → Link">
                <div className="absolute flex flex-col font-['Geist:Regular',sans-serif] font-normal h-[16px] justify-center leading-[0] left-[calc(50%+0.17px)] text-[#737373] text-[14px] text-center top-[15.75px] translate-x-[-50%] translate-y-[-50%] w-[44.254px]">
                  <p className="leading-[20px]">Events</p>
                </div>
              </div>
              <div className="absolute h-[36px] left-[446.25px] rounded-[8px] top-0 w-[83.52px]" data-name="Item → Link">
                <div className="absolute flex flex-col font-['Geist:Regular',sans-serif] font-normal h-[16px] justify-center leading-[0] left-[14.39px] text-[#737373] text-[14px] top-1/2 translate-y-[-50%] w-[55.098px]">
                  <p className="leading-[20px]">Explorer</p>
                </div>
              </div>
              <div className="absolute bg-[rgba(255,255,255,0.15)] h-[31.5px] left-[539.36px] overflow-clip rounded-[8px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.3),0px_1px_2px_-1px_rgba(0,0,0,0.3)] top-1/2 translate-y-[-50%] w-[59.22px]" data-name="Item → Button → Link">
                <div className="absolute flex flex-col font-['Geist:Regular',sans-serif] font-normal h-[16px] justify-center leading-[0] left-[calc(50%+0.17px)] text-[#737373] text-[14px] text-center top-[15.75px] translate-x-[-50%] translate-y-[-50%] w-[43.552px]">
                  <p className="leading-[20px]">Grants</p>
                </div>
              </div>
              <div className="absolute h-[31.5px] left-[609.76px] rounded-[8px] top-1/2 translate-y-[-50%] w-[93.38px]" data-name="Item → Button → Link">
                <div className="absolute flex flex-col font-['Geist:Regular',sans-serif] font-normal h-[16px] justify-center leading-[0] left-[calc(50%+0.16px)] text-[#737373] text-[14px] text-center top-[15.75px] translate-x-[-50%] translate-y-[-50%] w-[77.699px]">
                  <p className="leading-[20px]">Integrations</p>
                </div>
              </div>
              <div className="absolute h-[31.5px] left-[714.33px] rounded-[8px] top-1/2 translate-y-[-50%] w-[50.06px]" data-name="Item → Button → Link">
                <div className="absolute flex flex-col font-['Geist:Regular',sans-serif] font-normal h-[16px] justify-center leading-[0] left-[calc(50%+0.15px)] text-[#737373] text-[14px] text-center top-[15.75px] translate-x-[-50%] translate-y-[-50%] w-[34.363px]">
                  <p className="leading-[20px]">Stats</p>
                </div>
              </div>
            </div>
            <div className="absolute h-[46.75px] left-[958.92px] right-0 top-[calc(50%+0.01px)] translate-y-[-50%]" data-name="Container">
              <div className="absolute bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] border-solid h-[36px] left-[79.08px] right-[130px] rounded-[9999px] top-[calc(50%-0.01px)] translate-y-[-50%]" data-name="Button">
                <div className="absolute left-[10px] size-[16px] top-1/2 translate-y-[-50%]" data-name="SVG">
                  <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
                    <g id="SVG">
                      <path d={svgPaths.p107a080} id="Vector" stroke="var(--stroke-0, #737373)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
                      <path d="M14.0005 14L11.1338 11.1333" id="Vector_2" stroke="var(--stroke-0, #737373)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
                    </g>
                  </svg>
                </div>
                <div className="absolute flex flex-col font-['Geist:Regular',sans-serif] font-normal h-[16px] justify-center leading-[0] left-[calc(50%-62.11px)] text-[#737373] text-[14px] text-center top-1/2 translate-x-[-50%] translate-y-[-50%] w-[45.779px]">
                  <p className="leading-[20px]">Search</p>
                </div>
                <div className="absolute bg-[#121212] border border-[#161616] border-solid bottom-[6px] left-[155.98px] rounded-[6px] top-[6px] w-[47.61px]" data-name="Keyboard">
                  <div className="absolute flex flex-col font-['Geist_Mono:Regular',sans-serif] font-normal h-[16px] justify-center leading-[0] left-[calc(50%+0.15px)] text-[#737373] text-[14px] text-center top-[10px] translate-x-[-50%] translate-y-[-50%] w-[33.912px]">
                    <p className="leading-[20px]">Ctrl</p>
                  </div>
                </div>
                <div className="absolute bg-[#121212] border border-[#161616] border-solid bottom-[6px] left-[205.59px] rounded-[6px] top-[6px] w-[22.41px]" data-name="Keyboard">
                  <div className="absolute flex flex-col font-['Geist_Mono:Regular',sans-serif] font-normal h-[16px] justify-center leading-[0] left-[calc(50%+0.19px)] text-[#737373] text-[14px] text-center top-[10px] translate-x-[-50%] translate-y-[-50%] w-[8.795px]">
                    <p className="leading-[20px]">K</p>
                  </div>
                </div>
              </div>
              <div className="absolute border border-[rgba(255,255,255,0.1)] border-solid h-[36px] right-[62px] rounded-[9999px] top-[calc(50%-0.01px)] translate-y-[-50%] w-[62px]" data-name="Button - Toggle Theme">
                <Group1SvgBackgroundImage additionalClassNames="left-[4px]">
                  <path d={svgPaths.p1ae08280} fill="var(--fill-0, #737373)" id="Vector" stroke="var(--stroke-0, #737373)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.16667" />
                  <g id="Vector_2">
                    <path d="M13 2.16667V4.33333Z" fill="var(--fill-0, #737373)" />
                    <path d="M13 2.16667V4.33333" stroke="var(--stroke-0, #737373)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.16667" />
                  </g>
                  <g id="Vector_3">
                    <path d="M13 21.6667V23.8333Z" fill="var(--fill-0, #737373)" />
                    <path d="M13 21.6667V23.8333" stroke="var(--stroke-0, #737373)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.16667" />
                  </g>
                  <g id="Vector_4">
                    <path d={svgPaths.p149fd800} fill="var(--fill-0, #737373)" />
                    <path d={svgPaths.p2ba6d600} stroke="var(--stroke-0, #737373)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.16667" />
                  </g>
                  <g id="Vector_5">
                    <path d={svgPaths.p7bab000} fill="var(--fill-0, #737373)" />
                    <path d={svgPaths.p27b4a9c0} stroke="var(--stroke-0, #737373)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.16667" />
                  </g>
                  <g id="Vector_6">
                    <path d="M2.16699 13H4.33366Z" fill="var(--fill-0, #737373)" />
                    <path d="M2.16699 13H4.33366" stroke="var(--stroke-0, #737373)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.16667" />
                  </g>
                  <g id="Vector_7">
                    <path d="M21.667 13H23.8337Z" fill="var(--fill-0, #737373)" />
                    <path d="M21.667 13H23.8337" stroke="var(--stroke-0, #737373)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.16667" />
                  </g>
                  <g id="Vector_8">
                    <path d={svgPaths.p3cbf8f80} fill="var(--fill-0, #737373)" />
                    <path d={svgPaths.p46d4680} stroke="var(--stroke-0, #737373)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.16667" />
                  </g>
                  <g id="Vector_9">
                    <path d={svgPaths.p330e00} fill="var(--fill-0, #737373)" />
                    <path d={svgPaths.p928c000} stroke="var(--stroke-0, #737373)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.16667" />
                  </g>
                </Group1SvgBackgroundImage>
                <Group1SvgBackgroundImage additionalClassNames="bg-[rgba(104,104,104,0.3)] left-[30px]">
                  <path d={svgPaths.pc500500} fill="var(--fill-0, #E6E6E6)" id="Vector" stroke="var(--stroke-0, #E6E6E6)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.16667" />
                </Group1SvgBackgroundImage>
              </div>
              <div className="absolute left-[399.08px] size-[32px] top-[6px]" data-name="List → Button → Link → SVG">
                <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
                  <g id="List â Button â Link â SVG">
                    <path d={svgPaths.pe988480} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.13333" />
                    <path d={svgPaths.p26aadf00} id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.13333" />
                    <path d={svgPaths.p3435ce00} id="Vector_3" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.13333" />
                  </g>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="h-[627px] overflow-clip relative shrink-0 w-full" data-name="Hero">
        <div className="absolute h-[1083.196px] left-[0.19px] top-[-162.36px] w-[1925.212px]" data-name="Background3_R1 1">
          <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover pointer-events-none size-full" src={imgBackground3R11} />
        </div>
        <div className="absolute h-[1151.749px] left-[0.19px] top-[-196.63px] w-[1441.686px]" data-name="Background3_R1_Square 1">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <img alt="" className="absolute left-0 max-w-none size-full top-[-3.48%]" src={imgBackground3R1Square1} />
          </div>
        </div>
        <div className="absolute h-[627.287px] left-[-1.88px] top-0 w-[1443.75px]" data-name="Direction2_R2 1">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <img alt="" className="absolute h-[129.47%] left-0 max-w-none top-[-29.47%] w-full" src={imgDirection2R21} />
          </div>
        </div>
        <div className="absolute bg-gradient-to-b from-1/2 h-[344px] left-0 to-[#152d44] top-[283.29px] w-[1440px]" />
        <div className="absolute h-[352.506px] left-[2px] top-[150px] w-[1438px]">
          <div className="absolute h-[352.506px] left-0 top-0 w-[479.333px]">
            <div className="absolute h-[243px] overflow-clip right-0 top-[calc(50%+0.25px)] translate-y-[-50%] w-[323px]" data-name="Layer_1">
              <div className="absolute contents inset-[46.21%_0_24.11%_0]" data-name="Group">
                <div className="absolute inset-[46.21%_0_24.11%_0]" data-name="Group">
                  <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 323.005 72.1347">
                    <g id="Group">
                      <path d={svgPaths.p2880cc80} fill="var(--fill-0, white)" id="Vector" />
                      <path d={svgPaths.p1024ba00} fill="var(--fill-0, white)" id="Vector_2" />
                      <path d={svgPaths.p89eaf00} fill="var(--fill-0, white)" id="Vector_3" />
                      <path d={svgPaths.p1dcd2d00} fill="var(--fill-0, white)" id="Vector_4" />
                    </g>
                  </svg>
                </div>
                <div className="absolute inset-[46.5%_17.59%_24.36%_67.76%]" data-name="Group">
                  <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 47.3147 70.81">
                    <g id="Group">
                      <path d={svgPaths.p3d78ecf0} fill="var(--fill-0, white)" id="Vector" />
                      <path d={svgPaths.p282d1b00} fill="var(--fill-0, white)" id="Vector_2" />
                    </g>
                  </svg>
                </div>
              </div>
              <div className="absolute inset-[14.85%_11.78%_55.76%_11.85%]" data-name="Group">
                <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 246.684 71.4233">
                  <g id="Group">
                    <g id="Group_2">
                      <path d={svgPaths.pc1d1300} fill="var(--fill-0, white)" id="Vector" />
                      <path d={svgPaths.p3f05600} fill="var(--fill-0, white)" id="Vector_2" />
                    </g>
                    <path d={svgPaths.p202c2600} fill="var(--fill-0, white)" id="Vector_3" />
                    <path d={svgPaths.p1cb94c00} fill="var(--fill-0, white)" id="Vector_4" />
                    <path d={svgPaths.p17d1df00} fill="var(--fill-0, white)" id="Vector_5" />
                  </g>
                </svg>
              </div>
              <div className="absolute inset-[0_32.71%_91.65%_32.71%]" data-name="Group">
                <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 111.697 20.284">
                  <g id="Group">
                    <path d={svgPaths.p3591fd00} fill="var(--fill-0, white)" id="Vector" />
                    <path d={svgPaths.p21ff0d00} fill="var(--fill-0, white)" id="Vector_2" />
                    <path d={svgPaths.p301e600} fill="var(--fill-0, white)" id="Vector_3" />
                    <path d={svgPaths.p1acad00} fill="var(--fill-0, white)" id="Vector_4" />
                    <path d={svgPaths.p1bd17400} fill="var(--fill-0, white)" id="Vector_5" />
                    <path d={svgPaths.p2893f240} fill="var(--fill-0, white)" id="Vector_6" />
                    <path d={svgPaths.p24119c80} fill="var(--fill-0, white)" id="Vector_7" />
                    <path d={svgPaths.p365e9880} fill="var(--fill-0, white)" id="Vector_8" />
                    <path d={svgPaths.p5699d00} fill="var(--fill-0, white)" id="Vector_9" />
                    <path d={svgPaths.p27194540} fill="var(--fill-0, #FF394A)" id="Vector_10" />
                    <path d={svgPaths.p24ffea00} fill="var(--fill-0, #FF394A)" id="Vector_11" />
                  </g>
                </svg>
              </div>
              <div className="absolute inset-[81.44%_34.82%_0_34.82%]" data-name="Group">
                <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 98.0849 45.1175">
                  <g id="Group">
                    <g id="Group_2">
                      <path d={svgPaths.p20f4d440} fill="url(#paint0_radial_1_1152)" id="Vector" />
                      <path d={svgPaths.p25948900} fill="url(#paint1_radial_1_1152)" id="Vector_2" />
                      <path d={svgPaths.p11b86480} fill="url(#paint2_radial_1_1152)" id="Vector_3" />
                      <path d={svgPaths.p207e2300} fill="url(#paint3_radial_1_1152)" id="Vector_4" />
                      <path d={svgPaths.p1dad8a30} fill="url(#paint4_radial_1_1152)" id="Vector_5" />
                      <path d={svgPaths.p383e7780} fill="var(--fill-0, white)" id="Vector_6" />
                      <path d={svgPaths.p3d73eb80} fill="var(--fill-0, white)" id="Vector_7" />
                    </g>
                    <path d={svgPaths.p29458e00} fill="url(#paint5_radial_1_1152)" id="Vector_8" />
                    <path d={svgPaths.p2a71e080} fill="url(#paint6_radial_1_1152)" id="Vector_9" />
                    <path d={svgPaths.p368ccb80} fill="var(--fill-0, white)" id="Vector_10" />
                    <path d={svgPaths.p264da170} fill="var(--fill-0, white)" id="Vector_11" />
                    <path d={svgPaths.p16a1080} fill="url(#paint7_radial_1_1152)" id="Vector_12" />
                    <path d={svgPaths.p29a4b640} fill="var(--fill-0, white)" id="Vector_13" />
                  </g>
                  <defs>
                    <radialGradient cx="0" cy="0" gradientTransform="translate(30.0905 16.8647) scale(8.44435 8.46744)" gradientUnits="userSpaceOnUse" id="paint0_radial_1_1152" r="1">
                      <stop offset="0.32" stopColor="#CCCCCC" />
                      <stop offset="1" stopColor="white" />
                    </radialGradient>
                    <radialGradient cx="0" cy="0" gradientTransform="translate(41.6529 29.7273) scale(6.54449 6.56238)" gradientUnits="userSpaceOnUse" id="paint1_radial_1_1152" r="1">
                      <stop offset="0.32" stopColor="#CCCCCC" />
                      <stop offset="1" stopColor="white" />
                    </radialGradient>
                    <radialGradient cx="0" cy="0" gradientTransform="translate(73.6936 29.3014) scale(5.95166 5.96793)" gradientUnits="userSpaceOnUse" id="paint2_radial_1_1152" r="1">
                      <stop offset="0.32" stopColor="#CCCCCC" />
                      <stop offset="1" stopColor="white" />
                    </radialGradient>
                    <radialGradient cx="0" cy="0" gradientTransform="translate(23.3551 28.2949) scale(8.07559 8.09766)" gradientUnits="userSpaceOnUse" id="paint3_radial_1_1152" r="1">
                      <stop stopColor="#CCCCCC" />
                      <stop offset="1" stopColor="white" />
                    </radialGradient>
                    <radialGradient cx="0" cy="0" gradientTransform="translate(61.7116 18.8024) scale(5.32148 5.33603)" gradientUnits="userSpaceOnUse" id="paint4_radial_1_1152" r="1">
                      <stop stopColor="#CCCCCC" />
                      <stop offset="1" stopColor="white" />
                    </radialGradient>
                    <radialGradient cx="0" cy="0" gradientTransform="translate(56.3479 28.4167) scale(5.92365 5.93984)" gradientUnits="userSpaceOnUse" id="paint5_radial_1_1152" r="1">
                      <stop offset="0.32" stopColor="#CCCCCC" />
                      <stop offset="1" stopColor="white" stopOpacity="0" />
                    </radialGradient>
                    <radialGradient cx="0" cy="0" gradientTransform="translate(36.7325 18.6339) scale(5.5082 5.52326)" gradientUnits="userSpaceOnUse" id="paint6_radial_1_1152" r="1">
                      <stop offset="0.32" stopColor="#CCCCCC" />
                      <stop offset="1" stopColor="white" />
                    </radialGradient>
                    <radialGradient cx="0" cy="0" gradientTransform="translate(69.4041 19.2472) scale(4.57928 4.59179)" gradientUnits="userSpaceOnUse" id="paint7_radial_1_1152" r="1">
                      <stop offset="0.32" stopColor="#CCCCCC" />
                      <stop offset="1" stopColor="white" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                </svg>
              </div>
            </div>
          </div>
          <div className="absolute content-stretch flex flex-col h-[352.506px] items-start justify-center left-[958.67px] p-[10px] top-1/2 translate-y-[-50%] w-[479.333px]">
            <div className="absolute content-stretch flex flex-col font-['Aeonik:Medium',sans-serif] gap-[16px] items-start leading-[0] left-[0.33px] not-italic text-white top-[99.38px]">
              <div className="flex flex-col justify-center relative shrink-0 text-[82px] w-[479.333px]">
                <p className="leading-[72px]">$1,000,000</p>
              </div>
              <div className="flex flex-col justify-center relative shrink-0 text-[36px] w-[250.333px]">
                <p className="leading-[37.602px]">In Prizes</p>
              </div>
            </div>
          </div>
          <div className="absolute h-[352.506px] left-[479.33px] top-0 w-[479.333px]" />
        </div>
      </div>
      <div className="h-[284px] relative shrink-0 w-full" data-name="Tiles">
        <div className="overflow-clip rounded-[inherit] size-full">
          <div className="content-stretch flex flex-col items-start px-[186px] py-[25px] relative size-full">
            <div className="basis-0 content-stretch flex grow items-start min-h-px min-w-px relative shrink-0">
              <div className="content-stretch flex gap-[10px] h-full items-center relative shrink-0 w-[1068px]">
                <Group1BackgroundImage text="$1,000,000" text1="Prize Pool" />
                <Group1BackgroundImage text="6 Weeks" text1="Duration" />
                <Group1BackgroundImage text="Jan 2026" text1="Applications Open" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="h-[232px] relative shrink-0 w-full" data-name="CTA">
        <div className="flex flex-col justify-center overflow-clip rounded-[inherit] size-full">
          <div className="content-stretch flex flex-col items-start justify-center pb-[24px] pt-0 px-[186px] relative size-full">
            <div className="content-stretch flex gap-[16px] items-center relative shrink-0 w-full">
              <div className="basis-0 grow min-h-px min-w-px relative shrink-0">
                <div className="flex flex-col items-end overflow-clip rounded-[inherit] size-full">
                  <Group1BackgroundImageAndText text="Apply Today" additionalClassNames="items-end" />
                </div>
              </div>
              <div className="basis-0 flex flex-row grow items-center self-stretch shrink-0">
                <div className="basis-0 grow h-full min-h-px min-w-px relative shrink-0">
                  <div className="flex flex-row items-center overflow-clip rounded-[inherit] size-full">
                    <Group1BackgroundImage1 text="Login" text1="Apply Today" additionalClassNames="py-[10px]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="relative shrink-0 w-full" data-name="CTA">
        <div className="flex flex-col justify-center size-full">
          <div className="content-stretch flex flex-col gap-[16px] items-start justify-center px-[186px] py-0 relative w-full">
            <div className="gradient-border-section-top relative rounded-tl-[16px] rounded-tr-[16px] shrink-0 w-full">
              <div className="content-stretch flex gap-[16px] items-start p-[24px] relative w-full">
                <Group1BackgroundImage6>
                  {`What is `}
                  <br aria-hidden="true" />
                  Build Games?
                </Group1BackgroundImage6>
                <Group1BackgroundImage5>
                  <p className="mb-0">
                    Avalanche's flagship online builder competition for crypto-native talent. Six fast-paced weeks to turn your next big idea into a real product on Avalanche.
                    <br aria-hidden="true" />
                    <br aria-hidden="true" />
                  </p>
                  <p className="mb-0">If you've been waiting for a reason to build, this is it.</p>
                  <p>&nbsp;</p>
                </Group1BackgroundImage5>
              </div>
            </div>
            <div className="gradient-border-section relative rounded-[16px] shrink-0 w-full">
              <div className="content-stretch flex flex-col gap-[16px] items-start pt-[24px] px-[24px] pb-0 relative w-full">
                <div className="content-stretch flex items-start pb-[24px] pt-0 px-0 relative shrink-0 w-full">
                  <Group1BackgroundImage6>
                    {`Who `}
                    <br aria-hidden="true" />
                    Should Apply
                  </Group1BackgroundImage6>
                  <Group1BackgroundImage5>
                    <p className="mb-0">
                      We're looking for builders, not bounty hunters.
                      <br aria-hidden="true" />
                      <br aria-hidden="true" />
                    </p>
                    <p>You're a fit if you:</p>
                  </Group1BackgroundImage5>
                </div>
              </div>
              <div className="content-stretch flex h-[234px] items-start justify-between relative shrink-0 w-full px-[1px]">
                <div className="content-stretch flex gap-[10px] h-full items-center relative shrink-0 w-full">
                  <BackgroundImageAndText text="Are a solo dev or small team with something new and original" />
                  <BackgroundImageAndText text="Want to (re)start in the Avalanche ecosystem" />
                  <BackgroundImageAndText text="Have an idea and need structure, mentorship, and a push" />
                  <BackgroundImageAndText text="Want to learn, compete, and grow with other builders" />
                </div>
              </div>
            </div>
            <div className="gradient-border-section relative rounded-[16px] shrink-0 w-full">
              <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover opacity-30 pointer-events-none rounded-[16px] size-full" src={imgFrame23} />
              <div className="content-stretch flex flex-col items-start overflow-clip pb-0 pt-[24px] px-0 relative rounded-[inherit] w-full">
                <BackgroundImage6>
                  <Group1BackgroundImage6>
                    {`How `}
                    <br aria-hidden="true" />
                    it works
                  </Group1BackgroundImage6>
                  <BackgroundImage1>
                    <p className="font-['Aeonik:Regular',sans-serif] leading-[1.5] min-w-full not-italic relative shrink-0 text-[20px] text-white w-[min-content]">6 weeks of building, mentoring, and competing.</p>
                  </BackgroundImage1>
                </BackgroundImage6>
                <BackgroundImage3 additionalClassNames="bg-[rgba(255,255,255,0.15)]">
                  <Group1BackgroundImageAndText1 text="Week 1" />
                  <BackgroundImage7>
                    <Group1BackgroundImageAndText2 text="Focus" />
                    <Group1BackgroundImageAndText3 text="Idea Pitch" />
                    <Group1BackgroundImageAndText4 text="Deliverables" additionalClassNames="[grid-area:1_/_2]" />
                    <Group1BackgroundImageAndText4 text="Support" additionalClassNames="[grid-area:1_/_3]" />
                    <Group1BackgroundImageAndText5 text="1-min video pitching your concept" additionalClassNames="[grid-area:2_/_2]" />
                    <Group1BackgroundImageAndText5 text="Video and pitch feedback" additionalClassNames="[grid-area:2_/_3]" />
                  </BackgroundImage7>
                </BackgroundImage3>
                <BackgroundImage3 additionalClassNames="bg-[rgba(255,255,255,0.1)]">
                  <Group1BackgroundImageAndText1 text="Week 3" />
                  <BackgroundImage7>
                    <Group1BackgroundImageAndText2 text="Focus" />
                    <Group1BackgroundImageAndText3 text="Prototype / MVP" />
                    <Group1BackgroundImageAndText4 text="Deliverables" additionalClassNames="[grid-area:1_/_2]" />
                    <Group1BackgroundImageAndText5 text="Demo, GitHub, short product walkthrough" additionalClassNames="[grid-area:2_/_2]" />
                  </BackgroundImage7>
                </BackgroundImage3>
                <BackgroundImage3 additionalClassNames="bg-[rgba(255,255,255,0.06)]">
                  <Group1BackgroundImageAndText1 text="Week 5" />
                  <BackgroundImage7>
                    <Group1BackgroundImageAndText2 text="Focus" />
                    <BackgroundImage2>{`GTM Plan & Vision`}</BackgroundImage2>
                    <Group1BackgroundImageAndText4 text="Deliverables" additionalClassNames="[grid-area:1_/_2]" />
                    <Group1BackgroundImageAndText5 text="Growth plan and progress update" additionalClassNames="[grid-area:2_/_2]" />
                  </BackgroundImage7>
                </BackgroundImage3>
                <BackgroundImage3 additionalClassNames="bg-[rgba(255,255,255,0.02)]">
                  <Group1BackgroundImageAndText1 text="Week 6" />
                  <BackgroundImage7>
                    <Group1BackgroundImageAndText2 text="Focus" />
                    <Group1BackgroundImageAndText3 text="Finals" />
                    <Group1BackgroundImageAndText4 text="Deliverables" additionalClassNames="[grid-area:1_/_2]" />
                    <Group1BackgroundImageAndText5 text="Judging and live showcase" additionalClassNames="[grid-area:2_/_2]" />
                  </BackgroundImage7>
                </BackgroundImage3>
              </div>
            </div>
            <div className="gradient-border-section relative rounded-[16px] shrink-0 w-full">
              <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover opacity-30 pointer-events-none rounded-[16px] size-full" src={imgFrame23} />
              <div className="content-stretch flex flex-col gap-[10px] items-start overflow-clip pb-0 pt-[24px] px-0 relative rounded-[inherit] w-full">
                <BackgroundImage6>
                  <div className="content-stretch flex flex-col gap-[10px] items-start overflow-clip p-[10px] relative shrink-0 w-[478px]">
                    <div className="flex flex-col font-['Aeonik:Medium',sans-serif] justify-center leading-[0] min-w-full not-italic relative shrink-0 text-[48px] text-white w-[min-content]">
                      <p className="leading-none">What You're Competing For</p>
                    </div>
                  </div>
                  <div className="basis-0 content-stretch flex flex-col grow items-center min-h-px min-w-px px-0 py-[24px] relative shrink-0">
                    <div className="content-stretch flex flex-col gap-[16px] items-center leading-[0] not-italic overflow-clip relative shrink-0 text-center text-white w-[542px]">
                      <div className="flex flex-col font-['Aeonik:Medium',sans-serif] justify-center relative shrink-0 text-[64px] tracking-[3.2px] w-[448.834px]">
                        <p className="leading-none">$1,000,000</p>
                      </div>
                      <div className="flex flex-col font-['Aeonik:Medium',sans-serif] h-[27.942px] justify-center relative shrink-0 text-[24px] w-[286.47px]">
                        <p className="leading-none">Total Prize Pool</p>
                      </div>
                    </div>
                  </div>
                </BackgroundImage6>
                <BackgroundImage8>
                  <BackgroundImage9>
                    <div aria-hidden="true" className="absolute inset-0 pointer-events-none rounded-[16px]">
                      <div className="absolute bg-[rgba(81,153,197,0.5)] inset-0 rounded-[16px]" />
                      <img alt="" className="absolute max-w-none object-50%-50% object-cover rounded-[16px] size-full" src={imgFrame23} />
                    </div>
                    <BackgroundImage10>
                      <div className="flex flex-col font-['Aeonik:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[48px] text-white w-full">
                        <p className="leading-[72px]">$100,000</p>
                      </div>
                      <BackgroundImageAndText1 text="Grand Prize" additionalClassNames="py-[16px]" />
                    </BackgroundImage10>
                  </BackgroundImage9>
                  <BackgroundImage9>
                    <div aria-hidden="true" className="absolute inset-0 pointer-events-none rounded-[16px]">
                      <div className="absolute bg-[#224a71] inset-0 rounded-[16px]" />
                      <div className="absolute inset-0 overflow-hidden rounded-[16px]">
                        <img alt="" className="absolute h-[94.16%] left-0 max-w-none top-[2.92%] w-full" src={imgFrame23} />
                      </div>
                    </div>
                    <BackgroundImage10>
                      <div className="flex flex-col font-['Aeonik:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[48px] text-white w-full">
                        <p className="leading-[72px]">$75,000</p>
                      </div>
                      <BackgroundImageAndText1 text="Runner-Up" additionalClassNames="py-[16px]" />
                    </BackgroundImage10>
                  </BackgroundImage9>
                </BackgroundImage8>
                <BackgroundImage8 additionalClassNames="h-[234px]">
                  <BackgroundImage9>
                    <div aria-hidden="true" className="absolute inset-0 pointer-events-none rounded-[16px]">
                      <div className="absolute bg-[rgba(34,74,113,0.5)] inset-0 rounded-[16px]" />
                      <img alt="" className="absolute max-w-none object-50%-50% object-cover rounded-[16px] size-full" src={imgFrame23} />
                    </div>
                    <BackgroundImage10>
                      <div className="flex flex-col font-['Aeonik:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[48px] text-white w-full">
                        <p className="leading-[72px]">$50,000</p>
                      </div>
                      <BackgroundImageAndText1 text="Third Place" additionalClassNames="py-[16px]" />
                    </BackgroundImage10>
                  </BackgroundImage9>
                  <BackgroundImage9>
                    <div aria-hidden="true" className="absolute inset-0 pointer-events-none rounded-[16px]">
                      <div className="absolute bg-[rgba(27,59,91,0.5)] inset-0 rounded-[16px]" />
                      <img alt="" className="absolute max-w-none object-50%-50% object-cover rounded-[16px] size-full" src={imgFrame23} />
                    </div>
                    <BackgroundImage10>
                      <div className="flex flex-col font-['Aeonik:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[48px] text-white w-full">
                        <p className="leading-[72px]">$5–10k</p>
                      </div>
                      <BackgroundImageAndText1 text="Category Prizes" additionalClassNames="py-[16px]" />
                    </BackgroundImage10>
                  </BackgroundImage9>
                </BackgroundImage8>
                <div className="content-stretch flex items-start justify-between relative shrink-0 w-full">
                  <div className="content-stretch flex gap-[10px] h-[117px] items-center relative shrink-0 w-[1068px]">
                    <Group1BackgroundImageAndText6 text="Ongoing grants and ecosystem support" />
                    <Group1BackgroundImageAndText6 text="Mentorship, network, and launch visibility via Avalanche channels" />
                    <Group1BackgroundImageAndText6 text="Post-event paths into programs like Codebase, Grants, and ecosystem partnerships" />
                  </div>
                </div>
              </div>
            </div>
            <div className="h-[24px] shrink-0 w-[197px]" data-name="Spacer" />
            <div className="gradient-border-section-top relative rounded-tl-[16px] rounded-tr-[16px] shrink-0 w-full">
              <div className="content-stretch flex gap-[48px] items-start p-[24px] relative w-full">
                <div className="content-stretch flex flex-col gap-[10px] items-start overflow-clip p-[10px] relative rounded-[16px] self-stretch shrink-0 w-[478px]">
                  <div className="absolute inset-0 opacity-75 overflow-hidden pointer-events-none rounded-[16px]">
                    <img alt="" className="absolute inset-0 w-full h-full object-cover" src={imgFrame27} />
                  </div>
                  <div className="flex flex-col font-['Aeonik:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[48px] text-white w-[306.049px]">
                    <p className="leading-none">What We're Looking For</p>
                  </div>
                </div>
                <div className="basis-0 content-stretch flex flex-col grow items-start min-h-px min-w-px relative self-stretch shrink-0">
                  <div className="content-stretch flex flex-col h-[116px] items-start overflow-clip relative shrink-0 w-full">
                    <div className="content-stretch flex items-start shrink-0 w-full" data-name="Spacer" />
                  </div>
                  <Group1BackgroundImage2 text="1." text1="Builder Drive" text2="Energy and follow-through" />
                  <BackgroundImage4>
                    <BackgroundImageAndText2 text="2." />
                    <Group1BackgroundImage3 text="Execution" text1="Ship a working product in six weeks" text2="&nbsp;" />
                  </BackgroundImage4>
                  <Group1BackgroundImage2 text="3." text1="Crypto Culture" text2="Build from within the culture, not outside it" />
                  <BackgroundImage4>
                    <BackgroundImageAndText2 text="4." />
                    <Group1BackgroundImage3 text="Long-Term Intent" text1="You're here to build something real, not just farm prizes" text2="&nbsp;" />
                  </BackgroundImage4>
                </div>
              </div>
            </div>
            <div className="gradient-border-section relative rounded-[16px] shrink-0 w-full">
              <div className="content-stretch flex flex-col gap-[16px] items-start pb-0 pt-[24px] px-[24px] relative w-full">
                <div className="content-stretch flex items-start pb-[24px] pt-0 px-0 relative shrink-0 w-full">
                  <Group1BackgroundImage6>Key Dates</Group1BackgroundImage6>
                  <div className="basis-0 grow min-h-px min-w-px relative shrink-0">
                    <div className="overflow-clip rounded-[inherit] size-full">
                      <div className="content-stretch flex flex-col items-start px-[24px] py-[10px] w-full" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="content-stretch flex items-start justify-between relative shrink-0 w-full px-[1px]">
                <div className="content-stretch flex gap-[10px] items-center relative self-stretch shrink-0 w-full">
                  <BackgroundImage11>
                    <Group1BackgroundImage4 text="JAN" text1="XX" text2="2026" />
                    <BackgroundImageAndText1 text="Applications Open" additionalClassNames="py-[10px]" />
                  </BackgroundImage11>
                  <BackgroundImage11>
                    <Group1BackgroundImage4 text="FEB" text1="XX" text2="2026" />
                    <BackgroundImageAndText1 text="Teams Announced" additionalClassNames="py-[10px]" />
                  </BackgroundImage11>
                  <BackgroundImage11>
                    <Group1BackgroundImage4 text="FEB" text1="15" text2="2026" />
                    <BackgroundImageAndText1 text="Competition Begins" additionalClassNames="py-[10px]" />
                  </BackgroundImage11>
                  <BackgroundImage11>
                    <Group1BackgroundImage4 text="MAR" text1="XX" text2="2026" />
                    <div className="content-stretch flex items-start px-0 py-[10px] relative shrink-0 w-full">
                      <p className="font-['Aeonik:Regular',sans-serif] leading-[1.25] not-italic relative shrink-0 text-[18px] text-white w-[211.5px]">{`Finals & Awards`}</p>
                    </div>
                  </BackgroundImage11>
                </div>
              </div>
              <div className="content-stretch flex items-center pb-[24px] pt-[36px] px-[24px] relative shrink-0 w-full">
                <div className="content-stretch flex flex-col items-start overflow-clip p-[10px] relative shrink-0 w-[478px]">
                  <div className="flex flex-col font-['Aeonik:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[48px] text-nowrap text-white">
                    <p className="leading-none">Agenda</p>
                  </div>
                </div>
                <div className="basis-0 grow min-h-px min-w-px relative shrink-0">
                  <div className="flex flex-row items-center justify-end overflow-clip rounded-[inherit] size-full">
                    <div className="content-stretch flex gap-[24px] items-center justify-end px-[24px] py-[10px] relative w-full">
                      <p className="font-['Aeonik:Regular',sans-serif] leading-[1.5] not-italic relative shrink-0 text-[20px] text-white w-[216.941px]">Add the event agenda to your google calendar</p>
                      <ButtonBackgroundImageAndText text="Add the Calendar" additionalClassNames="overflow-clip shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="gradient-border-section bg-[rgba(102,172,214,0.25)] relative rounded-[16px] shrink-0 w-full">
              <div className="content-stretch flex flex-col gap-[16px] items-start pb-[36px] pt-[24px] px-[24px] relative w-full">
                <div className="content-stretch flex flex-col items-center relative shrink-0 w-full">
                  <div className="relative shrink-0 w-full">
                    <div className="flex flex-col items-center overflow-clip rounded-[inherit] size-full">
                      <Group1BackgroundImageAndText text="Apply Today" additionalClassNames="items-center" />
                    </div>
                  </div>
                  <div className="content-stretch flex items-start justify-between relative shrink-0 w-full">
                    <div className="content-stretch flex gap-[10px] items-center justify-center relative shrink-0 w-[1068px]">
                      <Group1BackgroundImage7>
                        <div aria-hidden="true" className="absolute border-[#66acd6] border-[0px_0px_0px_4px] border-solid inset-0 pointer-events-none" />
                        <p className="font-['Aeonik:Regular',sans-serif] leading-[1.25] not-italic relative shrink-0 text-[18px] text-white w-[401.336px]">Spots are limited and reviewed on a rolling basis.</p>
                      </Group1BackgroundImage7>
                      <Group1BackgroundImage7>
                        <div aria-hidden="true" className="absolute border-[#66acd6] border-[0px_0px_0px_4px] border-solid inset-0 pointer-events-none" />
                        <p className="font-['Aeonik:Regular',sans-serif] leading-[1.25] not-italic relative shrink-0 text-[18px] text-nowrap text-white">Start your next chapter on Avalanche</p>
                      </Group1BackgroundImage7>
                    </div>
                  </div>
                  <div className="h-[77px] relative shrink-0 w-full">
                    <div className="flex flex-row items-center justify-center overflow-clip rounded-[inherit] size-full">
                      <Group1BackgroundImage1 text="Learn More" text1="Apply Today" additionalClassNames="justify-center py-0" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Frame1() {
  return (
    <div className="absolute h-[1045px] left-1/2 -translate-x-1/2 opacity-25 top-[629px] w-full">
      <GroupBackgroundImage />
    </div>
  );
}

function Frame() {
  return (
    <div className="absolute h-[1045px] left-1/2 -translate-x-1/2 opacity-25 top-[3138.91px] w-full">
      <GroupBackgroundImage />
    </div>
  );
}

export default function BuildGamesPage() {
  return (
    <div className="build-games-container" style={{ backgroundImage: "linear-gradient(90deg, rgb(21, 45, 68) 0%, rgb(21, 45, 68) 100%), linear-gradient(90deg, rgb(18, 18, 18) 0%, rgb(18, 18, 18) 100%)" }}>
      <div className="relative w-full" data-name="Landing Page Example">
        <Frame1 />
        <Frame />
        <Group1 />
      </div>
    </div>
  );
}
