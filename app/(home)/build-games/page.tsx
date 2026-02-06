import clsx from "clsx";
import Link from "next/link";
import "./styles.css";
import ReferralButton from "@/components/build-games/ReferralButton";
import ReferralLink from "@/components/build-games/ReferralLink";
import { ApplyButton } from "@/components/build-games/ApplyButton";
import ApplicationStatusTracker from "@/components/build-games/ApplicationStatusTracker";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Build Games 2026 | $1,000,000 Builder Competition on Avalanche",
  description: "Join Build Games 2026, a $1,000,000 builder competition on Avalanche. Build innovative projects, compete for prizes, and become part of the Avalanche ecosystem.",
  openGraph: {
    title: "Build Games 2026 | $1,000,000 Builder Competition on Avalanche",
    description: "Join Build Games 2026, a $1,000,000 builder competition on Avalanche. Build innovative projects, compete for prizes, and become part of the Avalanche ecosystem.",
    images: [
      {
        url: "/build-games/og-build-games.jpeg",
        width: 1200,
        height: 630,
        alt: "Build Games 2026 - $1,000,000 Builder Competition on Avalanche",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Build Games 2026 | $1,000,000 Builder Competition on Avalanche",
    description: "Join Build Games 2026, a $1,000,000 builder competition on Avalanche. Build innovative projects, compete for prizes, and become part of the Avalanche ecosystem.",
    images: ["/build-games/og-build-games.jpeg"],
  },
};

const imgBackground3R11 = "/build-games/background3-r1-1.png";
const imgBackground3R1Square1 = "/build-games/background3-r1-square-1.png";
const imgDirection2R21 = "/build-games/direction2-r2-1.png";
const imgFrame23 = "/build-games/frame-23.png";
const imgFrame27 = "/build-games/frame-27.png";

const svgPaths = {
  p1024ba00: "M93.9193 0.706787H107.741L134.073 71.5169H121.666L115.009 54.0156H86.0538L79.4953 71.5169H67.4893L93.924 0.706787H93.9193ZM111.779 44.1065L100.482 13.2511L89.284 44.1065H111.779Z",
  p11b86480: "M81.7365 4.30162C82.614 4.30162 83.4916 4.73693 83.9911 5.60755L93.439 22.0135C94.4427 23.7547 93.187 25.9313 91.1844 25.9313H72.2932C70.2859 25.9313 69.0349 23.7547 70.0385 22.0135L79.4865 5.60755C79.986 4.73693 80.8635 4.30162 81.7411 4.30162M81.7365 2.78158e-05C80.5648 2.78158e-05 79.4071 0.299597 78.3848 0.865965C77.2972 1.46978 76.3916 2.36848 75.7615 3.45909L66.3135 19.865C65.6833 20.9556 65.3659 22.1914 65.3846 23.4411C65.4032 24.6113 65.7253 25.7674 66.3135 26.7832C66.9017 27.7989 67.7372 28.6554 68.7362 29.2593C69.8005 29.9005 71.0281 30.2422 72.2885 30.2422H91.1797C92.4354 30.2422 93.6631 29.9005 94.7321 29.2593C95.731 28.6554 96.5666 27.7989 97.1548 26.7832C97.7429 25.7674 98.0603 24.6113 98.0837 23.4411C98.107 22.196 97.7849 20.9603 97.1548 19.865L87.7068 3.45909C87.0766 2.36848 86.171 1.46978 85.0834 0.865965C84.0658 0.299597 82.9034 2.78158e-05 81.7318 2.78158e-05H81.7365Z",
  p12bae8a0: "M1053.1 308.639L1105.6 399.54C1114.95 415.766 1113.5 434.031 1105.01 447.964C1127.01 456.119 1149.1 464.02 1171.19 472.006C1173.74 472.94 1176.37 473.875 1179 474.809C1186.05 459.263 1189.88 442.357 1190.13 425.281C1190.56 402.683 1184.7 380.256 1173.23 360.376L1110.19 251.21C1090.99 270.155 1072.39 289.694 1053.1 308.469V308.639Z",
  p12c8e000: "M297.608 78.0728C313.58 78.0728 329.551 85.9736 338.641 101.775L510.588 399.539C528.853 431.142 506.001 470.646 469.555 470.646H125.746C89.216 470.646 66.4483 431.142 84.7134 399.539L256.66 101.775C265.751 85.9736 281.722 78.0728 297.693 78.0728M297.608 0C276.285 0 255.216 5.43711 236.611 15.7166C216.817 26.6756 200.336 42.9869 188.867 62.7812L16.92 360.545C5.45119 380.339 -0.325602 402.767 0.0142148 425.45C0.354031 446.689 6.21578 467.672 16.92 486.107C27.6242 504.542 42.831 520.089 61.0112 531.048C80.3807 542.687 102.724 548.889 125.661 548.889H469.471C492.323 548.889 514.666 542.687 534.12 531.048C552.301 520.089 567.507 504.542 578.212 486.107C588.916 467.672 594.693 446.689 595.117 425.45C595.542 402.852 589.68 380.424 578.212 360.545L406.265 62.7812C394.796 42.9869 378.315 26.6756 358.52 15.7166C340 5.43711 318.847 0 297.523 0H297.608Z",
  p13277b00: "M523.732 424.474L497.777 469.42L406.039 471.891L479.404 344.844L523.732 424.474Z",
  p16a1080: "M64.7548 19.2565C64.9649 19.205 65.1796 19.1769 65.3943 19.1769C66.2719 19.1769 67.1495 19.6123 67.649 20.4829L71.6634 27.4572C73.4279 27.5508 75.1737 27.8597 76.9382 28.0095L71.3647 18.3297C70.7345 17.2391 69.8289 16.3404 68.7413 15.7366C67.7237 15.1703 66.5613 14.8707 65.3897 14.8707C64.4794 14.8707 63.5785 15.0532 62.7429 15.3996C62.8643 15.6898 62.9903 15.9706 63.1304 16.2515C63.6392 17.2719 64.2227 18.2455 64.7502 19.2518L64.7548 19.2565Z",
  p17d1df00: "M152.031 60.6997V5.51082e-05H140.431V60.6997H152.026V70.8148H182.4V60.6997H152.031Z",
  p1a2a9000: "M1082.34 442.441C1065.01 435.475 1047.93 427.744 1030.77 420.353L938.003 581.086C962.3 592.045 987.616 599.946 1013.44 606.657L1103.83 450.087C1096.53 447.708 1089.31 445.245 1082.34 442.526V442.441Z",
  p1a597800: "M892.632 78.0728C908.604 78.0728 924.575 85.9736 933.665 101.775L1105.61 399.539C1123.88 431.142 1101.02 470.646 1064.58 470.646H720.77C684.24 470.646 661.472 431.142 679.738 399.539L851.684 101.775C860.775 85.9736 876.746 78.0728 892.717 78.0728M892.632 0C871.309 0 850.24 5.43711 831.635 15.7166C811.841 26.6756 795.36 42.9869 783.891 62.7812L611.944 360.545C600.475 380.339 594.698 402.767 595.038 425.45C595.378 446.689 601.24 467.672 611.944 486.107C622.648 504.542 637.855 520.089 656.035 531.048C675.405 542.687 697.748 548.888 720.685 548.888H1064.49C1087.35 548.888 1109.69 542.687 1129.14 531.048C1147.32 520.089 1162.53 504.542 1173.24 486.107C1183.94 467.672 1189.72 446.689 1190.14 425.45C1190.57 402.852 1184.7 380.424 1173.24 360.545L1001.29 62.7812C989.82 42.9869 973.339 26.6756 953.544 15.7166C935.024 5.43711 913.871 0 892.547 0H892.632Z",
  p1acad00: "M63.0565 18.6411V20.1811H56.3066V18.6411H58.8133V10.4499L56.3066 11.283V9.73372L58.4539 8.90991H60.5685V18.6411H63.0612H63.0565Z",
  p1bd17400: "M72.4021 18.6551V20.1857H71.4918C70.4042 20.1857 69.9981 19.7129 69.984 18.9125C69.4332 19.7223 68.5696 20.2793 67.2766 20.2793C65.4748 20.2793 64.2238 19.3852 64.2238 17.8406C64.2238 16.1134 65.4374 15.1726 67.7481 15.1726H69.8113V14.6718C69.8113 13.745 69.1485 13.1739 68.0095 13.1739C66.9872 13.1739 66.3057 13.6607 66.1796 14.3909H64.4432C64.6346 12.7807 65.9976 11.7557 68.0935 11.7557C70.1894 11.7557 71.5478 12.8135 71.5478 14.7794V18.1121C71.5478 18.538 71.6925 18.6504 72.066 18.6504H72.4067L72.4021 18.6551ZM69.8067 16.4738H67.6687C66.5998 16.4738 65.9976 16.8811 65.9976 17.7236C65.9976 18.4257 66.5811 18.9125 67.5194 18.9125C68.9478 18.9125 69.8067 18.0512 69.8067 16.7968V16.4738Z",
  p1c6a2000: "M1190.13 348.058C1206.1 348.058 1222.07 355.959 1231.16 371.76L1403.11 669.524C1421.38 701.127 1398.52 740.631 1362.08 740.631H1018.27C981.738 740.631 958.97 701.127 977.235 669.524L1149.18 371.76C1158.27 355.959 1174.24 348.058 1190.22 348.058M1190.13 269.985C1168.81 269.985 1147.74 275.422 1129.13 285.702C1109.34 296.661 1092.86 312.972 1081.39 332.766L909.442 630.53C897.973 650.325 892.196 672.753 892.536 695.435C892.876 716.674 898.738 737.657 909.442 756.092C920.146 774.527 935.353 790.074 953.533 801.033C972.903 812.672 995.246 818.873 1018.18 818.873H1361.99C1384.85 818.873 1407.19 812.672 1426.64 801.033C1444.82 790.074 1460.03 774.527 1470.73 756.092C1481.44 737.657 1487.21 716.674 1487.64 695.435C1488.06 672.838 1482.2 650.41 1470.73 630.53L1298.79 332.766C1287.32 312.972 1270.84 296.661 1251.04 285.702C1232.52 275.422 1211.37 269.985 1190.05 269.985H1190.13Z",
  p1cb94c00: "M37.227 34.394C45.6014 32.5732 50.344 27.0079 50.344 18.414C50.344 6.77775 41.4656 5.6051e-05 25.9306 5.6051e-05H0V60.9993H11.5999V39.6552H26.9342C35.9153 39.6552 41.1575 43.4981 41.1575 50.477C41.1575 57.0535 36.2141 60.9993 26.9342 60.9993H11.5999V70.8101H26.8315C43.8836 70.8101 53.0608 63.1244 53.0608 51.0855C53.0608 40.7692 46.605 36.0136 37.2224 34.394H37.227ZM26.2293 30.0457H11.5999V9.71257H26.2293C34.3002 9.71257 38.7395 13.5554 38.7395 19.8276C38.7395 26.0998 34.1975 30.0457 26.2293 30.0457Z",
  p1dad8a30: "M65.3947 19.1769C66.2722 19.1769 67.1498 19.6122 67.6493 20.4828L77.0973 36.8887C78.1009 38.63 76.8452 40.8065 74.8426 40.8065H55.9514C53.9441 40.8065 52.6931 38.63 53.6967 36.8887L63.1447 20.4828C63.6442 19.6122 64.5218 19.1769 65.3993 19.1769M65.3947 14.8753C64.223 14.8753 63.0653 15.1748 62.0431 15.7412C60.9554 16.345 60.0498 17.2437 59.4197 18.3343L49.9717 34.7403C49.3415 35.8309 49.0241 37.0666 49.0428 38.3164C49.0614 39.4865 49.3835 40.6427 49.9717 41.6584C50.5599 42.6741 51.3954 43.5307 52.3944 44.1345C53.4587 44.7758 54.6863 45.1175 55.9467 45.1175H74.838C76.0936 45.1175 77.3213 44.7758 78.3903 44.1345C79.3892 43.5307 80.2248 42.6741 80.813 41.6584C81.4011 40.6427 81.7185 39.4865 81.7419 38.3164C81.7652 37.0713 81.4431 35.8356 80.813 34.7403L71.365 18.3343C70.7348 17.2437 69.8292 16.345 68.7416 15.7412C67.724 15.1748 66.5616 14.8753 65.39 14.8753H65.3947Z",
  p1dcd2d00: "M279.919 48.4549C280.526 56.7491 287.08 62.3145 296.971 62.3145C305.341 62.3145 311.4 58.5699 311.4 51.7922C311.4 44.3031 304.034 42.6882 292.835 40.6662C281.133 38.6394 270.037 34.8995 270.037 20.8386C270.037 8.59849 280.325 0 295.16 0C309.995 0 321.184 9.20699 321.791 21.9526H310.391C309.584 14.7724 303.632 9.8108 295.16 9.8108C287.192 9.8108 281.641 13.3541 281.641 20.0335C281.641 27.3167 288.905 28.8333 300.001 30.7571C311.703 32.8821 323.102 36.622 323.004 50.5846C323.004 63.129 312.109 72.1347 296.873 72.1347C279.826 72.1347 268.828 62.2209 268.524 48.263L279.924 48.4643L279.919 48.4549Z",
  p1fde9000: "M1178.49 349.501C1182.32 348.566 1186.22 348.057 1190.13 348.057C1206.1 348.057 1222.08 355.957 1231.17 371.759L1304.23 498.34C1336.34 500.04 1368.11 505.646 1400.22 508.365L1298.79 332.68C1287.32 312.886 1270.84 296.575 1251.04 285.616C1232.52 275.336 1211.37 269.899 1190.05 269.899C1173.48 269.899 1157.09 273.212 1141.88 279.499C1144.09 284.766 1146.38 289.863 1148.93 294.96C1158.19 313.48 1168.81 331.151 1178.41 349.416L1178.49 349.501Z",
  p202c2600: "M211.072 5.51082e-05H200.177V10.1151H211.072C226.509 10.1151 234.78 20.2348 234.78 35.4051C234.78 50.5753 226.509 60.6951 211.072 60.6951H200.177V10.1151H188.572V70.8101H211.067C232.96 70.8101 246.684 56.342 246.684 35.4051C246.684 14.4682 232.965 5.51082e-05 211.067 5.51082e-05H211.072Z",
  p207e2300: "M32.7003 19.1769C33.5779 19.1769 34.4555 19.6122 34.955 20.4828L44.4029 36.8887C45.4065 38.63 44.1509 40.8065 42.1483 40.8065H23.257C21.2498 40.8065 19.9988 38.63 21.0024 36.8887L30.4504 20.4828C30.9498 19.6122 31.8274 19.1769 32.705 19.1769M32.7003 14.8753C31.5287 14.8753 30.371 15.1748 29.3487 15.7412C28.2611 16.345 27.3555 17.2437 26.7253 18.3343L17.2774 34.7403C16.6472 35.8309 16.3298 37.0666 16.3484 38.3164C16.3671 39.4865 16.6892 40.6427 17.2774 41.6584C17.8655 42.6741 18.7011 43.5307 19.7 44.1345C20.7643 44.7758 21.992 45.1175 23.2524 45.1175H42.1436C43.3993 45.1175 44.627 44.7758 45.6959 44.1345C46.6949 43.5307 47.5305 42.6741 48.1186 41.6584C48.7068 40.6427 49.0242 39.4865 49.0476 38.3164C49.0709 37.0713 48.7488 35.8356 48.1186 34.7403L38.6707 18.3343C38.0405 17.2437 37.1349 16.345 36.0473 15.7412C35.0296 15.1748 33.8673 14.8753 32.6957 14.8753H32.7003Z",
  p2080d400: "M1191.84 443.884C1214.44 447.112 1238.23 445.838 1260.4 446.942C1265.24 447.197 1270.17 447.452 1275.01 447.622C1266.68 433.689 1265.33 415.594 1274.59 399.623L1324.71 312.885C1324.03 312.46 1323.43 312.035 1322.75 311.61C1301.6 297.508 1281.47 281.961 1261.5 266.245L1207.05 360.629C1195.58 380.423 1189.8 402.851 1190.14 425.534C1190.23 431.735 1190.82 437.937 1191.84 443.969V443.884Z",
  p20f4d440: "M16.3527 4.30162C17.2302 4.30162 18.1078 4.73693 18.6073 5.60755L28.0553 22.0135C29.0589 23.7547 27.8032 25.9313 25.8006 25.9313H6.90937C4.90215 25.9313 3.65113 23.7547 4.65474 22.0135L14.1027 5.60755C14.6022 4.73693 15.4798 4.30162 16.3573 4.30162M16.3527 2.78158e-05C15.181 2.78158e-05 14.0234 0.299597 13.0011 0.865965C11.9134 1.46978 11.0078 2.36848 10.3777 3.45909L0.929699 19.865C0.299524 20.9556 -0.0178934 22.1914 0.000778506 23.4411C0.0194504 24.6113 0.341536 25.7674 0.929699 26.7832C1.51786 27.7989 2.35343 28.6554 3.35238 29.2593C4.41667 29.9005 5.64435 30.2422 6.9047 30.2422H25.796C27.0517 30.2422 28.2793 29.9005 29.3483 29.2593C30.3472 28.6554 31.1828 27.7989 31.771 26.7832C32.3591 25.7674 32.6765 24.6113 32.6999 23.4411C32.7232 22.196 32.4011 20.9603 31.771 19.865L22.323 3.45909C21.6928 2.36848 20.7872 1.46978 19.6996 0.865965C18.682 0.299597 17.5197 2.78158e-05 16.348 2.78158e-05H16.3527Z",
  p21ff0d00: "M40.781 20.181L37.6348 11.854H39.516L41.8873 18.2947L44.24 11.854H46.0838L42.9236 20.181H40.781Z",
  p24119c80: "M83.9322 16.0338C83.9322 13.4641 85.5707 11.7557 88.068 11.7557C90.192 11.7557 91.5223 12.9446 91.8444 14.8309H90.0146C89.7859 13.8526 89.0903 13.2535 88.0354 13.2535C86.6443 13.2535 85.7154 14.4096 85.7154 16.0385C85.7154 17.6674 86.6396 18.7861 88.0354 18.7861C89.0716 18.7861 89.7858 18.1683 89.9959 17.2087H91.8444C91.5363 19.095 90.1219 20.284 88.0167 20.284C85.5193 20.284 83.9276 18.641 83.9276 16.0385L83.9322 16.0338Z",
  p24b6cc30: "M1487.56 78.0728C1503.53 78.0728 1519.51 85.9736 1528.6 101.775L1700.54 399.539C1718.81 431.142 1695.96 470.646 1659.51 470.646H1315.7C1279.17 470.646 1256.4 431.142 1274.67 399.539L1446.62 101.775C1455.71 85.9736 1471.68 78.0728 1487.65 78.0728M1487.56 0C1466.24 0 1445.17 5.43711 1426.57 15.7166C1406.77 26.6756 1390.29 42.9869 1378.82 62.7812L1206.88 360.545C1195.41 380.339 1189.63 402.767 1189.97 425.45C1190.31 446.689 1196.17 467.672 1206.88 486.107C1217.58 504.542 1232.79 520.089 1250.97 531.048C1270.34 542.687 1292.68 548.889 1315.62 548.889H1659.43C1682.28 548.889 1704.62 542.687 1724.08 531.048C1742.26 520.089 1757.46 504.542 1768.17 486.107C1778.87 467.672 1784.65 446.689 1785.07 425.45C1785.5 402.852 1779.64 380.424 1768.17 360.545L1596.22 62.7812C1584.75 42.9869 1568.27 26.6756 1548.48 15.7166C1529.96 5.43711 1508.8 0 1487.48 0H1487.56Z",
  p24ffea00: "M15.3033 5.88601L12.1525 0.414244C11.835 -0.138081 11.0368 -0.138081 10.7194 0.414244L0.123112 18.8189C-0.226985 19.4227 0.2118 20.181 0.907328 20.181H7.21842C7.89061 20.181 8.51144 19.8205 8.84754 19.2354L15.3033 8.02043C15.6861 7.36044 15.6861 6.546 15.3033 5.88601Z",
  p2591ff40: "M1111.13 414.236C1116.65 442.186 1095.59 470.731 1064.58 470.731H831.378C834.521 497.151 839.958 523.317 847.604 548.803H1064.58C1087.43 548.803 1109.77 542.602 1129.23 530.963C1147.41 520.004 1162.61 504.457 1173.32 486.022C1182.32 470.391 1187.85 453.06 1189.63 435.305C1163.46 428.424 1137.38 421.287 1111.22 414.236H1111.13Z",
  p25948900: "M49.047 4.30159C49.9246 4.30159 50.8021 4.7369 51.3016 5.60752L60.7496 22.0135C61.7532 23.7547 60.4975 25.9312 58.4949 25.9312H39.6037C37.5965 25.9312 36.3454 23.7547 37.3491 22.0135L46.797 5.60752C47.2965 4.7369 48.1741 4.30159 49.0516 4.30159M49.047 0C47.8753 0 46.7177 0.299569 45.6954 0.865938C44.6077 1.46975 43.7022 2.36846 43.072 3.45906L33.624 19.865C32.9938 20.9556 32.6764 22.1913 32.6951 23.4411C32.7138 24.6113 33.0359 25.7674 33.624 26.7831C34.2122 27.7988 35.0477 28.6554 36.0467 29.2592C37.111 29.9005 38.3387 30.2422 39.599 30.2422H58.4903C59.746 30.2422 60.9736 29.9005 62.0426 29.2592C63.0415 28.6554 63.8771 27.7988 64.4653 26.7831C65.0534 25.7674 65.3709 24.6113 65.3942 23.4411C65.4175 22.196 65.0955 20.9603 64.4653 19.865L55.0173 3.45906C54.3871 2.36846 53.4815 1.46975 52.3939 0.865938C51.3763 0.299569 50.214 0 49.0423 0H49.047Z",
  p264da170: "M59.471 24.3772C58.5187 23.9934 57.5804 23.5675 56.6375 23.1602L51.5401 32.0162C52.8751 32.62 54.2662 33.0553 55.6853 33.4251L60.652 24.7985C60.2505 24.6674 59.8537 24.5317 59.471 24.3819V24.3772Z",
  p27194540: "M14.3422 20.1809H22.0117C22.6885 20.1809 23.1133 19.4461 22.7725 18.861L18.9401 12.2003C18.5994 11.6152 17.7545 11.6152 17.4184 12.2003L13.586 18.861C13.2452 19.4461 13.67 20.1809 14.3469 20.1809H14.3422Z",
  p282d1b00: "M47.3146 60.4937H11.628V70.81H47.3146V60.4937Z",
  p2880cc80: "M34.3003 0.0982377C50.6428 0.0982377 62.042 9.80606 64.4647 24.7844H52.9628C50.6428 15.7787 43.7809 10.3163 33.9969 10.3163C20.5811 10.3163 11.9034 20.9368 11.9034 36.1118C11.9034 51.2867 20.3757 61.9073 33.8988 61.9073C44.7939 61.9073 53.5696 55.7334 54.1765 44.303V42.5852H34.6037V32.7697H65.2722V71.5168H56.4918L55.2828 61.4017C51.8518 66.4569 44.5885 72.1253 33.39 72.1253C13.6165 72.1253 5.02806e-05 57.6572 5.02806e-05 36.1118C5.02806e-05 14.5664 13.3131 0.0982377 34.3003 0.0982377Z",
  p2893f240: "M81.7801 15.4347V20.1857H80.0109V15.5986C80.0109 14.1195 79.3808 13.305 78.1251 13.305C76.8087 13.305 76.0152 14.2646 76.0152 15.8747V20.1857H74.2647V11.8587H75.7911L75.9825 12.9493C76.482 12.2987 77.2662 11.7604 78.5265 11.7604C80.2957 11.7604 81.7708 12.7199 81.7708 15.4394L81.7801 15.4347Z",
  p29458e00: "M61.0532 22.8232C61.3566 24.3632 60.1989 25.9359 58.4951 25.9359H45.6816C45.8543 27.3916 46.153 28.8333 46.5731 30.2375H58.4951C59.7508 30.2375 60.9785 29.8958 62.0475 29.2545C63.0464 28.6507 63.882 27.7941 64.4701 26.7784C64.9649 25.9172 65.2684 24.9623 65.3664 23.984C63.9287 23.6049 62.4956 23.2117 61.0578 22.8232H61.0532Z",
  p29a4b640: "M65.4879 24.4567C66.7296 24.6346 68.0366 24.5644 69.2549 24.6253C69.521 24.6393 69.7917 24.6533 70.0578 24.6627C69.6004 23.8951 69.5257 22.8981 70.0345 22.0181L72.7886 17.2391C72.7512 17.2157 72.7186 17.1923 72.6812 17.1689C71.5189 16.3919 70.4126 15.5353 69.3156 14.6693L66.3234 19.8696C65.6933 20.9602 65.3759 22.196 65.3945 23.4457C65.3992 23.7874 65.4319 24.1291 65.4879 24.4614V24.4567Z",
  p2a71e080: "M30.9722 19.4203C31.0143 19.5233 31.0516 19.6262 31.0889 19.7292C31.5557 19.3641 32.1252 19.1769 32.6947 19.1769C33.5723 19.1769 34.4499 19.6122 34.9493 20.4828L39.1832 27.8362C39.4353 27.8362 39.6873 27.8362 39.9441 27.8362C41.3165 27.8362 42.6888 27.7379 44.0566 27.6958L38.665 18.3343C38.0349 17.2437 37.1293 16.345 36.0417 15.7412C35.024 15.1749 33.8617 14.8753 32.6901 14.8753C31.5184 14.8753 30.3607 15.1749 29.3385 15.7412C29.2544 15.788 29.1751 15.8348 29.0957 15.8863C29.3151 16.2701 29.5578 16.6493 29.7866 17.0238C30.2487 17.7914 30.6315 18.5918 30.9629 19.425L30.9722 19.4203Z",
  p2fbaaa30: "M595.12 348.058C611.091 348.058 627.063 355.959 636.153 371.76L808.1 669.524C826.365 701.127 803.512 740.631 767.067 740.631H423.258C386.728 740.631 363.96 701.127 382.225 669.524L554.172 371.76C563.262 355.959 579.234 348.058 595.205 348.058M595.12 269.985C573.796 269.985 552.728 275.422 534.123 285.702C514.329 296.661 497.848 312.972 486.379 332.766L314.432 630.53C302.963 650.325 297.186 672.753 297.526 695.435C297.866 716.674 303.728 737.657 314.432 756.092C325.136 774.527 340.343 790.074 358.523 801.033C377.892 812.672 400.235 818.873 423.173 818.873H766.982C789.835 818.873 812.178 812.672 831.632 801.033C849.812 790.074 865.019 774.527 875.723 756.092C886.427 737.657 892.205 716.674 892.629 695.435C893.054 672.838 887.192 650.41 875.723 630.53L703.776 332.766C692.307 312.972 675.826 296.661 656.032 285.702C637.512 275.422 616.359 269.985 595.035 269.985H595.12Z",
  p300dd580: "M563.687 352.476C564.452 354.345 565.132 356.214 565.811 358.083C574.307 351.456 584.671 348.058 595.035 348.058C611.007 348.058 626.978 355.959 636.068 371.76L713.121 505.223C717.709 505.223 722.297 505.223 726.969 505.223C751.946 505.223 776.922 503.439 801.814 502.675L703.691 332.766C692.223 312.972 675.742 296.661 655.947 285.702C637.427 275.422 616.274 269.985 594.95 269.985C573.627 269.985 552.558 275.422 533.953 285.702C532.424 286.551 530.98 287.401 529.536 288.335C533.528 295.302 537.946 302.183 542.109 308.979C550.519 322.912 557.485 337.439 563.517 352.561L563.687 352.476Z",
  p301e600: "M55.0327 18.6551V20.1857H54.1224C53.0348 20.1857 52.6286 19.7129 52.6146 18.9125C52.0638 19.7223 51.2002 20.2793 49.9072 20.2793C48.1054 20.2793 46.8544 19.3852 46.8544 17.8406C46.8544 16.1134 48.068 15.1726 50.3787 15.1726H52.4419V14.6718C52.4419 13.745 51.7791 13.1739 50.6401 13.1739C49.6178 13.1739 48.9363 13.6607 48.8102 14.3909H47.0738C47.2651 12.7807 48.6282 11.7557 50.7241 11.7557C52.82 11.7557 54.1784 12.8135 54.1784 14.7794V18.1121C54.1784 18.538 54.3231 18.6504 54.6966 18.6504H55.0373L55.0327 18.6551ZM52.4373 16.4738H50.2993C49.2304 16.4738 48.6282 16.8811 48.6282 17.7236C48.6282 18.4257 49.2117 18.9125 50.1546 18.9125C51.583 18.9125 52.4419 18.0512 52.4419 16.7968V16.4738H52.4373Z",
  p351bbc80: "M624.851 444.054C631.562 451.19 639.378 451.19 648.553 450.68C659.172 450.086 669.537 448.896 679.731 447.197C671.576 433.35 670.386 415.424 679.561 399.538L731.383 309.826C727.645 306.004 723.907 302.266 719.999 298.697C708.87 288.418 697.656 278.309 686.273 268.454C681.855 264.631 677.267 260.129 672.34 255.881L611.938 360.459C605.991 370.739 601.573 381.698 598.77 393.082C603.782 402.427 607.52 412.536 611.853 422.476C615.166 430.122 619.074 437.852 624.851 443.969V444.054Z",
  p3591fd00: "M36.9675 18.6551V20.1857H36.0573C34.9696 20.1857 34.5635 19.7129 34.5495 18.9125C33.9987 19.7223 33.1351 20.2793 31.8421 20.2793C30.0403 20.2793 28.7893 19.3852 28.7893 17.8406C28.7893 16.1134 30.0029 15.1726 32.3136 15.1726H34.3768V14.6718C34.3768 13.745 33.714 13.1739 32.575 13.1739C31.5527 13.1739 30.8712 13.6607 30.7451 14.3909H29.0087C29.2001 12.7807 30.5631 11.7557 32.659 11.7557C34.7549 11.7557 36.1133 12.8135 36.1133 14.7794V18.1121C36.1133 18.538 36.258 18.6504 36.6314 18.6504H36.9722L36.9675 18.6551ZM34.3722 16.4738H32.2296C31.1606 16.4738 30.5584 16.8811 30.5584 17.7236C30.5584 18.4257 31.1419 18.9125 32.0849 18.9125C33.5133 18.9125 34.3722 18.0512 34.3722 16.7968V16.4738Z",
  p365e9880: "M101.549 15.4348V20.1858H99.7799V15.5799C99.7799 14.1476 99.1498 13.3051 97.8521 13.3051C96.5544 13.3051 95.7095 14.2834 95.7095 15.8608V20.1858H93.959V8.80225H95.7095V12.9213C96.279 12.2051 97.1379 11.7651 98.2582 11.7651C100.205 11.7651 101.549 12.9213 101.549 15.4442V15.4348Z",
  p368ccb80: "M34.3336 24.4662C34.7024 24.8593 35.1318 24.8593 35.636 24.8313C36.2194 24.7985 36.7889 24.733 37.3491 24.6394C36.901 23.8764 36.8356 22.8888 37.3398 22.0135L40.1872 17.0706C39.9818 16.86 39.7764 16.654 39.5617 16.4574C38.9502 15.8911 38.334 15.3341 37.7085 14.7911C37.4658 14.5805 37.2137 14.3324 36.943 14.0984L33.6241 19.8603C33.2973 20.4267 33.0546 21.0305 32.9005 21.6577C33.1759 22.1726 33.3813 22.7296 33.6194 23.2773C33.8014 23.6985 34.0162 24.1245 34.3336 24.4615V24.4662Z",
  p383e7780: "M30.8371 25.7909C29.8241 25.5288 28.8018 25.2901 27.8029 24.9905C27.3361 25.5569 26.6312 25.936 25.7957 25.936H19.2605C18.8031 27.4198 18.1169 28.8521 17.4307 30.2376H25.7957C27.0514 30.2376 28.279 29.8959 29.348 29.2546C30.3469 28.6508 31.1825 27.7943 31.7707 26.7785C31.892 26.5679 31.9994 26.3573 32.0974 26.1373C31.682 26.0109 31.2619 25.8986 30.8417 25.7909H30.8371Z",
  p3d73eb80: "M57.865 17.0051L60.7498 22.0134C61.2633 22.9074 61.184 23.9138 60.7172 24.6814C61.9262 25.1308 63.1398 25.5661 64.3535 26.0061C64.4935 26.0576 64.6382 26.1091 64.783 26.1606C65.1704 25.304 65.3805 24.3725 65.3945 23.4317C65.4178 22.1866 65.0957 20.9509 64.4655 19.8556L61.0019 13.8409C59.9469 14.8847 58.9247 15.9612 57.865 16.9957V17.0051Z",
  p3d78ecf0: "M11.5999 60.4797V39.9594H40.0512V29.9426H11.5999V10.321H46.1055V0H0V60.4797H11.5999Z",
  p3f05600: "M132.56 0V70.8101H120.961V0H132.56Z",
  p5699d00: "M105.451 16.4269V16.5112C105.498 17.9248 106.375 18.8562 107.738 18.8562C108.775 18.8562 109.568 18.318 109.801 17.3912H111.552C111.258 19.0341 109.881 20.2839 107.836 20.2839C105.241 20.2839 103.621 18.5941 103.621 16.0384C103.621 13.4828 105.246 11.7603 107.659 11.7603C110.072 11.7603 111.65 13.2909 111.697 15.7295C111.697 15.9074 111.683 16.1835 111.65 16.4316H105.451V16.4269ZM105.516 15.107H109.876C109.731 13.8713 108.887 13.1692 107.668 13.1692C106.581 13.1692 105.638 13.9181 105.507 15.107H105.516Z",
  p89eaf00: "M152.488 0.706719L175.086 56.4448L197.277 0.706719H212.01V71.5168H200.811V19.4156L179.628 71.5168H169.844L148.661 19.4156V71.5168H137.462V0.706719H152.493H152.488Z",
  pc1d1300: "M69.4079 2.6776e-05V41.0734C69.4079 54.2263 74.4493 61.1022 85.5497 61.1022C96.6501 61.1022 101.892 54.2216 101.892 41.0734V2.6776e-05H113.492V40.4649C113.492 60.5967 103.909 71.4233 85.545 71.4233C67.1812 71.4233 57.7986 60.5967 57.7986 40.4649V2.6776e-05H69.4032H69.4079Z",
};

function CardBackground() {
  return (
    <div aria-hidden="true" className="absolute inset-0 pointer-events-none rounded-[16px]">
      <div className="absolute bg-[#0b1e30] inset-0 rounded-[16px]" />
      <img alt="" className="absolute max-w-none object-50%-50% object-cover rounded-[16px] size-full" src={imgFrame23} />
    </div>
  );
}

function PrimaryButton({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={clsx("bg-[#66acd6] content-stretch flex h-[36px] items-center justify-center px-[36px] py-[6px] relative rounded-[3.35544e+07px] shrink-0", className)}>
      <div className="flex flex-col font-['Aeonik:Medium',sans-serif] font-medium justify-center leading-[0] relative shrink-0 text-[#152d44] text-[14px] text-center text-nowrap">
        <p className="leading-[20px]">{text}</p>
      </div>
    </div>
  );
}

function SecondaryButton({ text }: { text: string }) {
  return (
    <div className="content-stretch flex flex-col items-center relative shrink-0" data-name="Link">
      <div className="bg-[rgba(40,106,142,0.1)] content-stretch flex h-[36px] items-center justify-center px-[49px] py-[7px] relative rounded-[3.35544e+07px] shrink-0" data-name="Button">
        <div aria-hidden="true" className="absolute border border-[rgba(102,172,214,0.5)] border-solid inset-0 pointer-events-none rounded-[3.35544e+07px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]" />
        <div className="flex flex-col font-['Aeonik:Medium',sans-serif] font-medium justify-center leading-[0] relative shrink-0 text-[#66acd6] text-[14px] text-center text-nowrap">
          <p className="leading-[20px]">{text}</p>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: React.PropsWithChildren) {
  return (
    <div className="content-stretch flex flex-col gap-[10px] items-start overflow-clip p-[10px] relative shrink-0 w-[478px]">
      <div className="flex flex-col font-['Aeonik:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[48px] text-white w-[306.049px]"><p className="leading-none">{children}</p></div>
    </div>
  );
}

function BodyText({ children }: React.PropsWithChildren) {
  return (
    <div className="basis-0 grow min-h-px min-w-px relative shrink-0">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col gap-[10px] items-start px-[24px] py-[10px] relative w-full">{children}</div>
      </div>
    </div>
  );
}

function BodyTextParagraph({ children }: React.PropsWithChildren) {
  return (
    <BodyText>
      <div className="font-['Aeonik:Regular',sans-serif] leading-[1.5] min-w-full not-italic relative shrink-0 text-[20px] text-white w-[min-content]">{children}</div>
    </BodyText>
  );
}

function CardDescription({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={clsx("content-stretch flex items-start px-0 relative shrink-0 w-full", className)}>
      <p className="font-['Aeonik:Regular',sans-serif] leading-[1.25] not-italic relative shrink-0 text-[18px] text-white w-[211.5px]">{text}</p>
    </div>
  );
}

function LargeHeading({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={clsx("content-stretch flex flex-col gap-[10px] p-[10px] relative w-full", className)}>
      <div className="flex flex-col font-['Aeonik:Medium',sans-serif] font-medium justify-center leading-[0] not-italic relative shrink-0 text-[48px] text-nowrap text-white">
        <p className="leading-[72px]">{text}</p>
      </div>
    </div>
  );
}

function HeroTile({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="gradient-border-card basis-0 grow h-full min-h-px min-w-px relative rounded-[16px] shrink-0">
      <CardBackground />
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col font-['Aeonik:Medium',sans-serif] items-start justify-between leading-[0] not-italic px-[36px] py-[60px] relative size-full text-white">
          <div className="flex flex-col justify-center relative shrink-0 text-[48px] w-full"><p className="leading-[72px]">{title}</p></div>
          <div className="flex flex-col justify-center relative shrink-0 text-[24px] w-full"><p className="leading-[37.602px]">{subtitle}</p></div>
        </div>
      </div>
    </div>
  );
}

function CTAButtonGroup({ secondaryText, primaryText, className = "" }: { secondaryText: string; primaryText: string; className?: string }) {
  return (
    <div className={clsx("content-stretch flex items-center px-[24px] relative size-full", className)}>
      <div className="content-stretch flex gap-[10px] items-center relative shrink-0">
        <SecondaryButton text={secondaryText} />
        <PrimaryButton text={primaryText} className="shadow-[0px_0px_25px_0px_rgba(46,177,255,0.55)]" />
      </div>
    </div>
  );
}

function ApplicantCard({ children }: React.PropsWithChildren) {
  return (
    <div className="gradient-border-card basis-0 grow h-full min-h-px min-w-px relative shrink-0 rounded-[16px]">
      <CardBackground />
      <div className="overflow-clip rounded-[inherit] size-full">{children}</div>
    </div>
  );
}

function ApplicantCardWithText({ text, icon }: { text: string; icon: string }) {
  return (
    <ApplicantCard>
      <div className="content-stretch flex flex-col gap-[10px] items-start p-[24px] relative size-full">
        <img src={icon} alt="" className="shrink-0 size-[42px] object-contain" /><CardDescription text={text} className="py-[36px]" />
      </div>
    </ApplicantCard>
  );
}

function TimelineRow({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={clsx("relative shrink-0 w-full", className)}>
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center p-[24px] relative w-full">{children}</div>
      </div>
    </div>
  );
}

function WeekLabel({ text }: { text: string }) {
  return (
    <div className="content-stretch flex flex-col gap-[10px] items-start justify-center overflow-clip p-[10px] relative shrink-0 w-[405px]">
      <div className="flex flex-col font-['Aeonik:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#66acd6] text-[24px] w-[306.049px]"><p className="leading-none">{text}</p></div>
    </div>
  );
}

function ThreeColumnGrid({ children }: React.PropsWithChildren) {
  return (
    <div className="basis-0 content-stretch flex flex-col grow items-start min-h-px min-w-px overflow-clip relative shrink-0">
      <div className="gap-[10px] grid grid-cols-[repeat(3,_minmax(0px,_1fr))] grid-rows-[repeat(2,_fit-content(100%))] relative shrink-0 w-full">{children}</div>
    </div>
  );
}

function GridLabel({ text }: { text: string }) {
  return (
    <div className="[grid-area:1_/_1] content-stretch flex items-start px-0 py-[3px] relative shrink-0 w-[151px]">
      <div className="flex flex-col font-['Aeonik:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#66acd6] text-[12px] text-nowrap"><p className="leading-none">{text}</p></div>
    </div>
  );
}

function GridValue({ children }: React.PropsWithChildren) {
  return (
    <div className="[grid-area:2_/_1] content-stretch flex items-start relative shrink-0 w-[151px]">
      <div className="flex flex-col font-['Aeonik:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[16px] text-nowrap text-white"><p className="leading-none">{children}</p></div>
    </div>
  );
}

function GridHeader({ text, gridArea }: { text: string; gridArea: string }) {
  return (
    <div className={clsx("h-[19.617px] relative shrink-0 w-[93.233px]", `[grid-area:${gridArea}]`)}>
      <div className="absolute flex flex-col font-['Aeonik:Medium',sans-serif] h-[19.617px] justify-center leading-[0] left-0 not-italic text-[#66acd6] text-[12px] top-[9.81px] translate-y-[-50%] w-[93.233px]"><p className="leading-none">{text}</p></div>
    </div>
  );
}

function GridContent({ text, gridArea }: { text: string; gridArea: string }) {
  return (
    <div className={clsx("h-[32px] relative shrink-0 w-[174px]", `[grid-area:${gridArea}]`)}>
      <div className="absolute flex flex-col font-['Aeonik:Medium',sans-serif] justify-center leading-[0] left-0 not-italic text-[16px] text-white top-[16px] translate-y-[-50%] w-[174px]"><p className="leading-none">{text}</p></div>
    </div>
  );
}

function PrizeRowContainer({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={clsx("content-stretch flex flex-col items-start relative shrink-0 w-full", className)}>
      <div className="content-stretch flex gap-[10px] items-center relative shrink-0 w-[1068px]">{children}</div>
    </div>
  );
}

function PrizeCard({ children }: React.PropsWithChildren) {
  return (
    <div className="basis-0 flex flex-row grow items-center self-stretch shrink-0">
      <div className="gradient-border-card basis-0 grow h-full min-h-px min-w-px relative rounded-[16px] shrink-0">{children}</div>
    </div>
  );
}

function PrizeCardContent({ children }: React.PropsWithChildren) {
  return (
    <div className="overflow-clip rounded-[inherit] size-full">
      <div className="content-stretch flex flex-col gap-[10px] items-start p-[24px] relative size-full">{children}</div>
    </div>
  );
}

function PrizeAmount({ amount }: { amount: string }) {
  return (
    <div className="flex flex-col font-['Aeonik:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[48px] text-white w-full"><p className="leading-[72px]">{amount}</p></div>
  );
}

function BenefitCard({ text, shortText }: { text: string; shortText?: string }) {
  return (
    <div className="gradient-border-card basis-0 grow h-full min-h-px min-w-px relative rounded-[16px] shrink-0">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col items-start p-[24px] relative size-full">
          <div className="basis-0 grow min-h-px min-w-px relative shrink-0 w-full">
            <div aria-hidden="true" className="absolute border-[#66acd6] border-[0px_0px_0px_4px] border-solid inset-0 pointer-events-none" />
            <div className="content-stretch flex items-start px-[24px] py-0 relative size-full">
              {shortText ? (
                <>
                  <p className="hidden md:block font-['Aeonik:Regular',sans-serif] leading-[1.25] not-italic relative shrink-0 text-[18px] text-white w-[277.333px]">{text}</p>
                  <p className="block md:hidden font-['Aeonik:Regular',sans-serif] leading-[1.25] not-italic relative shrink-0 text-[18px] text-white w-[277.333px]">{shortText}</p>
                </>
              ) : (
                <p className="font-['Aeonik:Regular',sans-serif] leading-[1.25] not-italic relative shrink-0 text-[18px] text-white w-[277.333px]">{text}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DateCard({ children }: React.PropsWithChildren) {
  return (
    <div className="gradient-border-card relative shrink-0 basis-0 grow rounded-[16px]">
      <CardBackground />
      <div className="content-stretch flex flex-col gap-[10px] items-start overflow-clip p-[24px] relative rounded-[inherit]">{children}</div>
    </div>
  );
}

function DateBadge({ month, day, year }: { month: string; day: string; year: string }) {
  return (
    <div className="relative rounded-[8px] shrink-0 size-[75px]">
      <div className="content-stretch flex flex-col items-center justify-center leading-[1.25] not-italic overflow-clip p-[5px] relative rounded-[inherit] size-full text-center text-white">
        <p className="font-['Aeonik:Regular',sans-serif] relative shrink-0 text-[16px] w-[57.146px]">{month}</p>
        <p className="font-['Aeonik:Medium',sans-serif] relative shrink-0 text-[24px] text-nowrap">{day}</p>
        <p className="font-['Aeonik:Regular',sans-serif] relative shrink-0 text-[12px] w-[57.146px]">{year}</p>
      </div>
      <div aria-hidden="true" className="absolute border border-[#66acd6] border-solid inset-0 pointer-events-none rounded-[8px]" />
    </div>
  );
}

function NumberedCircle({ number }: { number: string }) {
  return (
    <div className="relative rounded-[100px] shrink-0 size-[50px]">
      <div className="content-stretch flex flex-col items-center justify-center overflow-clip relative rounded-[inherit] size-full">
        <div className="flex flex-col font-['Aeonik:Regular',sans-serif] h-[64.65px] justify-center leading-[0] not-italic relative shrink-0 text-[24px] text-center text-white w-[79.642px]"><p className="leading-[1.5]">{number}</p></div>
      </div>
      <div aria-hidden="true" className="absolute border border-[#66acd6] border-solid inset-0 pointer-events-none rounded-[100px]" />
    </div>
  );
}

function CriteriaRowContainer({ children }: React.PropsWithChildren) {
  return (
    <div className="content-stretch flex flex-col items-start overflow-clip relative shrink-0 w-full">
      <div className="content-stretch flex gap-[24px] items-center relative shrink-0 w-full">{children}</div>
    </div>
  );
}

function CriteriaItem({ title, line1, line2 }: { title: string; line1: string; line2: string }) {
  return (
    <div className="basis-0 content-stretch flex flex-col grow items-start min-h-px min-w-px px-0 py-[24px] relative shrink-0">
      <div aria-hidden="true" className="absolute border-[#66acd6] border-[0px_0px_1px] border-solid inset-0 pointer-events-none" />
      <p className="font-['Aeonik:Regular',sans-serif] leading-[1.5] not-italic relative shrink-0 text-[48px] text-white w-full">{title}</p>
      <div className="font-['Aeonik:Regular',sans-serif] leading-[1.5] not-italic relative shrink-0 text-[20px] text-white w-full">
        <p className="mb-0">{line1}</p>
        <p>{line2}</p>
      </div>
    </div>
  );
}

function NumberedCriteriaRow({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <CriteriaRowContainer>
      <NumberedCircle number={number} />
      <div className="basis-0 content-stretch flex flex-col grow items-start min-h-px min-w-px px-0 py-[24px] relative shrink-0">
        <div aria-hidden="true" className="absolute border-[#66acd6] border-[0px_0px_1px] border-solid inset-0 pointer-events-none" />
        <p className="font-['Aeonik:Regular',sans-serif] leading-[1.5] not-italic relative shrink-0 text-[48px] text-white w-full">{title}</p>
        <p className="font-['Aeonik:Regular',sans-serif] leading-[1.5] not-italic relative shrink-0 text-[20px] text-white w-full">{description}</p>
      </div>
    </CriteriaRowContainer>
  );
}

function InfoBanner({ children }: React.PropsWithChildren) {
  return (
    <div className="flex flex-row items-center self-stretch">
      <div className="content-stretch flex flex-col h-full items-start overflow-clip p-[24px] relative rounded-[16px] shrink-0">
        <div className="content-stretch flex items-start px-[24px] py-0 relative shrink-0">{children}</div>
      </div>
    </div>
  );
}

function BackgroundDecoration() {
  return (
    <div className="absolute inset-[10.82%_-11.98%]">
      <svg className="block size-full" fill="none" preserveAspectRatio="xMidYMid meet" viewBox="0 0 1785.09 818.873">
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
          <radialGradient cx="0" cy="0" gradientTransform="translate(758.065 539.544) scale(119.106 119.106)" gradientUnits="userSpaceOnUse" id="paint2_radial_1_1204" r="1">
            <stop offset="0.32" stopColor="#0D263E" />
            <stop offset="1" stopColor="#0B1E30" />
          </radialGradient>
          <radialGradient cx="0" cy="0" gradientTransform="translate(425.042 513.548) scale(146.971 146.971)" gradientUnits="userSpaceOnUse" id="paint3_radial_1_1204" r="1">
            <stop stopColor="#0B1E30" />
            <stop offset="1" stopColor="#0B1E30" />
          </radialGradient>
          <linearGradient x1="478.889" x2="492.02" y1="471.891" y2="414.764" gradientUnits="userSpaceOnUse" id="paint4_linear_1_1204" >
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

function SectionHeader({ children }: React.PropsWithChildren) {
  return (
    <div className="relative shrink-0 w-full">
      <div className="content-stretch flex items-start pb-[24px] pt-0 px-[24px] relative w-full">{children}</div>
    </div>
  );
}

function HeroSection() {
  return (
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
  );
}

function HeroTilesSection() {
  return (
    <div className="h-[284px] relative shrink-0 w-full" data-name="Tiles">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col items-start px-[186px] py-[25px] relative size-full">
          <div className="basis-0 content-stretch flex grow items-start min-h-px min-w-px relative shrink-0">
            <div className="content-stretch flex gap-[10px] h-full items-center relative shrink-0 w-[1068px]">
              <HeroTile title="$1,000,000" subtitle="Prize Pool" />
              <HeroTile title="6 Weeks" subtitle="Duration" />
              <HeroTile title="Jan 2026" subtitle="Applications Open" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApplyTodayCTA() {
  return (
    <div className="get-involved-cta relative shrink-0 w-full py-[40px]" data-name="GetInvolvedCTA">
      <div className="flex flex-row flex-nowrap items-center justify-center gap-[16px] px-[16px]">
        <div className="font-['Aeonik:Medium',sans-serif] font-medium text-[64px] text-nowrap text-white leading-[80px]">
          Get Involved
        </div>
        <div className="flex flex-row flex-nowrap gap-[10px] items-center">
          <ReferralButton />
          <ApplyButton className="shrink-0 bg-[#66acd6] flex h-[52px] items-center justify-center px-[36px] py-[12px] rounded-[3.35544e+07px] cursor-pointer hover:bg-[#7bbde3] transition-colors shadow-[0px_0px_20px_4px_rgba(102,172,214,0.5)]">
            <span className="font-['Aeonik:Medium',sans-serif] font-medium text-[#152d44] text-[18px] text-center text-nowrap leading-[28px]">
              Apply
            </span>
          </ApplyButton>
        </div>
      </div>
    </div>
  );
}

function WhatIsBuildGamesSection() {
  return (
    <div className="gradient-border-section-top relative rounded-tl-[16px] rounded-tr-[16px] shrink-0 w-full">
      <div className="content-stretch flex gap-[16px] items-start p-[24px] relative w-full">
        <SectionTitle>
          {`What is `}
          <br aria-hidden="true" />
          Build Games?
        </SectionTitle>
        <BodyTextParagraph>
          <p className="mb-0">
            Avalanche's flagship online builder competition for crypto-native
            talent. Six fast-paced weeks to turn your next big idea into a real
            product on Avalanche.
            <br aria-hidden="true" />
            <br aria-hidden="true" />
          </p>
          <p className="mb-0">If you've been waiting for a reason to build, this is it.</p>
          <p>&nbsp;</p>
        </BodyTextParagraph>
      </div>
    </div>
  );
}

function WhoShouldApplySection() {
  return (
    <div className="gradient-border-section relative rounded-[16px] shrink-0 w-full">
      <div className="content-stretch flex flex-col gap-[16px] items-start pt-[24px] px-[24px] pb-0 relative w-full">
        <div className="content-stretch flex items-start pb-[24px] pt-0 px-0 relative shrink-0 w-full">
          <SectionTitle>
            {`Who `}
            <br aria-hidden="true" />
            Should Apply
          </SectionTitle>
          <BodyTextParagraph>
            <p className="mb-0">
              We're looking for builders, not bounty hunters.
              <br aria-hidden="true" />
              <br aria-hidden="true" />
            </p>
            <p>You're a fit if:</p>
          </BodyTextParagraph>
        </div>
      </div>
      <div className="content-stretch flex h-[234px] items-start justify-between relative shrink-0 w-full px-[1px]">
        <div className="content-stretch flex gap-[10px] h-full items-center relative shrink-0 w-full">
          <ApplicantCardWithText text="You are a solo dev or small team with something new and original" icon="/build-games/1_SoloDev.svg" />
          <ApplicantCardWithText text="You want to (re)start in the Avalanche ecosystem" icon="/build-games/2_StartAvalanche.svg" />
          <ApplicantCardWithText text="You have an idea and need structure, mentorship, and a push" icon="/build-games/3_Idea.svg" />
          <ApplicantCardWithText text="You want to learn, compete, and grow with other builders" icon="/build-games/4_Compete.svg" />
        </div>
      </div>
    </div>
  );
}

function HowItWorksSection() {
  return (
    <div className="gradient-border-section relative rounded-[16px] shrink-0 w-full">
      <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover opacity-30 pointer-events-none rounded-[16px] size-full" src={imgFrame23} />
      <div className="content-stretch flex flex-col items-start overflow-clip pb-0 pt-[24px] px-0 relative rounded-[inherit] w-full">
        <SectionHeader>
          <SectionTitle>
            {`How `}
            <br aria-hidden="true" />
            it works
          </SectionTitle>
          <BodyText>
            <p className="font-['Aeonik:Regular',sans-serif] leading-[1.5] min-w-full not-italic relative shrink-0 text-[20px] text-white w-[min-content]">
              6 weeks of building, mentoring, and competing.
            </p>
          </BodyText>
        </SectionHeader>
        <TimelineRow className="bg-[rgba(255,255,255,0.2)]">
          <WeekLabel text="Jan 20 - Feb 13" />
          <ThreeColumnGrid>
            <GridLabel text="Focus" />
            <GridValue>Application Process</GridValue>
            <GridHeader text="Deliverables" gridArea="1_/_2" />
            <GridHeader text="Support" gridArea="1_/_3" />
            <GridContent text="Submit your application" gridArea="2_/_2" />
            <GridContent text="Help and Feedback" gridArea="2_/_3" />
          </ThreeColumnGrid>
        </TimelineRow>
        <TimelineRow className="bg-[rgba(255,255,255,0.15)]">
          <WeekLabel text="Week 1" />
          <ThreeColumnGrid>
            <GridLabel text="Focus" />
            <GridValue>Idea Pitch</GridValue>
            <GridHeader text="Deliverables" gridArea="1_/_2" />
            <GridHeader text="Support" gridArea="1_/_3" />
            <GridContent text="1-min video pitching your concept" gridArea="2_/_2" />
            <GridContent text="Video and pitch feedback" gridArea="2_/_3" />
          </ThreeColumnGrid>
        </TimelineRow>
        <TimelineRow className="bg-[rgba(255,255,255,0.1)]">
          <WeekLabel text="Week 2 + 3" />
          <ThreeColumnGrid>
            <GridLabel text="Focus" />
            <GridValue>Prototype / MVP</GridValue>
            <GridHeader text="Deliverables" gridArea="1_/_2" />
            <GridHeader text="Support" gridArea="1_/_3" />
            <GridContent text="Demo, GitHub, short product walkthrough" gridArea="2_/_2" />
            <GridContent text="Technical guidance and feedback" gridArea="2_/_3" />
          </ThreeColumnGrid>
        </TimelineRow>
        <TimelineRow className="bg-[rgba(255,255,255,0.06)]">
          <WeekLabel text="Week 4 + 5" />
          <ThreeColumnGrid>
            <GridLabel text="Focus" />
            <GridValue>{`GTM Plan & Vision`}</GridValue>
            <GridHeader text="Deliverables" gridArea="1_/_2" />
            <GridHeader text="Support" gridArea="1_/_3" />
            <GridContent text="Growth plan and progress update" gridArea="2_/_2" />
            <GridContent text="GTM and strategy support" gridArea="2_/_3" />
          </ThreeColumnGrid>
        </TimelineRow>
        <TimelineRow className="bg-[rgba(255,255,255,0.02)]">
          <WeekLabel text="Week 6" />
          <ThreeColumnGrid>
            <GridLabel text="Focus" />
            <GridValue>Finals</GridValue>
            <GridHeader text="Deliverables" gridArea="1_/_2" />
            <GridHeader text="Support" gridArea="1_/_3" />
            <GridContent text="Judging and live showcase" gridArea="2_/_2" />
            <GridContent text="Pitch coaching and prep" gridArea="2_/_3" />
          </ThreeColumnGrid>
        </TimelineRow>
        <div className="content-stretch flex items-center pb-[24px] pt-[36px] px-[24px] relative shrink-0 w-full">
          <div className="content-stretch flex flex-col items-start overflow-clip p-[10px] relative shrink-0 w-[478px]">
            <div className="flex flex-col font-['Aeonik:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[48px] text-nowrap text-white">
              <p className="leading-none">Agenda</p>
            </div>
          </div>
          <div className="basis-0 grow min-h-px min-w-px relative shrink-0">
            <div className="flex flex-row items-center justify-end overflow-clip rounded-[inherit] size-full">
              <div className="content-stretch flex gap-[24px] items-center justify-end px-[24px] py-[10px] relative w-full">
                <p className="font-['Aeonik:Regular',sans-serif] leading-[1.5] not-italic relative shrink-0 text-[20px] text-white w-[216.941px]">
                  Add the event agenda to your google calendar
                </p>
                <a href="https://calendar.google.com/calendar/u/0/r?cid=Y19mNzExYTJkN2NjZDJhZTY2MWFjYmJlMjE5MDM4ZDZmYzcwMjRjNmFiMzJjNGVmZDhhNmVkYTIxMDY1MGRiODdiQGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20" target="_blank" rel="noopener noreferrer"><PrimaryButton text="Add the Calendar" className="overflow-clip shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)]" /></a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrizesSection() {
  return (
    <div className="gradient-border-section relative rounded-[16px] shrink-0 w-full">
      <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover opacity-30 pointer-events-none rounded-[16px] size-full" src={imgFrame23} />
      <div className="content-stretch flex flex-col gap-[10px] items-start overflow-clip pb-0 pt-[24px] px-0 relative rounded-[inherit] w-full">
        <SectionHeader>
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
        </SectionHeader>
        <PrizeRowContainer>
          <PrizeCard>
            <div aria-hidden="true" className="absolute inset-0 pointer-events-none rounded-[16px]">
              <div className="absolute bg-[rgba(81,153,197,0.5)] inset-0 rounded-[16px]" />
              <img alt="" className="absolute h-[94.16%] left-0 max-w-none top-[2.92%] w-full" src={imgFrame23} />
            </div>
            <PrizeCardContent>
              <PrizeAmount amount="$100,000" />
              <CardDescription text="Grand Prize" className="py-[16px]" />
            </PrizeCardContent>
          </PrizeCard>
          <PrizeCard>
            <div aria-hidden="true" className="absolute inset-0 pointer-events-none rounded-[16px]">
              <div className="absolute bg-[#224a71] inset-0 rounded-[16px]" />
              <div className="absolute inset-0 overflow-hidden rounded-[16px]">
                <img alt="" className="absolute h-[94.16%] left-0 max-w-none top-[2.92%] w-full" src={imgFrame23} />
              </div>
            </div>
            <PrizeCardContent>
              <PrizeAmount amount="$75,000" />
              <CardDescription text="Runner-Up" className="py-[16px]" />
            </PrizeCardContent>
          </PrizeCard>
        </PrizeRowContainer>
        <PrizeRowContainer className="h-[234px]">
          <PrizeCard>
            <div aria-hidden="true" className="absolute inset-0 pointer-events-none rounded-[16px]">
              <div className="absolute bg-[rgba(34,74,113,0.5)] inset-0 rounded-[16px]" />
              <img alt="" className="absolute max-w-none object-50%-50% object-cover rounded-[16px] size-full" src={imgFrame23} />
            </div>
            <PrizeCardContent>
              <PrizeAmount amount="$50,000" />
              <CardDescription text="Third Place" className="py-[16px]" />
            </PrizeCardContent>
          </PrizeCard>
          <PrizeCard>
            <div aria-hidden="true" className="absolute inset-0 pointer-events-none rounded-[16px]">
              <div className="absolute bg-[rgba(27,59,91,0.5)] inset-0 rounded-[16px]" />
              <img alt="" className="absolute max-w-none object-50%-50% object-cover rounded-[16px] size-full" src={imgFrame23} />
            </div>
            <PrizeCardContent>
              <PrizeAmount amount="$5-40k" />
              <CardDescription text="Category Prizes" className="py-[16px]" />
            </PrizeCardContent>
          </PrizeCard>
        </PrizeRowContainer>
        <div className="content-stretch flex items-start justify-between relative shrink-0 w-full">
          <div className="content-stretch flex gap-[10px] h-[117px] items-center relative shrink-0 w-[1068px]">
            <BenefitCard text="Ongoing grants and ecosystem support" />
            <BenefitCard text="Mentorship, network, and launch visibility via Avalanche channels" shortText="Mentorship, network, and launch visibility" />
            <BenefitCard text="Post-event paths into programs like Codebase, Grants, and ecosystem partnerships" shortText="Post-event paths into programs and ecosystem partnerships" />
          </div>
        </div>
      </div>
    </div>
  );
}

function WhatWereLookingForSection() {
  return (
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
          <NumberedCriteriaRow number="1." title="Builder Drive" description="Energy and follow-through" />
          <CriteriaRowContainer>
            <NumberedCircle number="2." />
            <CriteriaItem title="Execution" line1="Ship a working product in six weeks" line2="&nbsp;" />
          </CriteriaRowContainer>
          <NumberedCriteriaRow number="3." title="Crypto Culture" description="Build from within the culture, not outside it" />
          <CriteriaRowContainer>
            <NumberedCircle number="4." />
            <CriteriaItem title="Long-Term Intent" line1="You're here to build something real, not just farm prizes" line2="&nbsp;" />
          </CriteriaRowContainer>
        </div>
      </div>
    </div>
  );
}

function FAQsSection() {
  const faqs = [
    {
      question: "What is the purpose of Build Games?",
      answer: `Build Games exists to kickstart experimentation-first building on Avalanche.

This program is designed to:
• Attract top-tier, crypto-native builders
• Encourage grassroots experimentation
• Generate new apps, ideas, and onchain use cases
• Funnel strong teams into long-term Avalanche ecosystem programs`
    },
    {
      question: "Who is eligible to apply?",
      answer: `Build Games is open to builders of all kinds.

Eligible participants include:
• Crypto-native developers
• Builders between projects
• Teams that are new to Avalanche
• Anyone willing to bring a new idea to life

There are no tracks, no themes, and no restrictions on what you can build.

*If you have previously received funding from the Avalanche Foundation, this may be considered in the event that your project is selected as a winner.`
    },
    {
      question: "When do applications close?",
      answer: "Applications close February 13th (tentative)."
    },
    {
      question: "How are projects evaluated?",
      answer: `Projects are evaluated holistically, with a strong emphasis on experimentation, originality, and long-term potential, rather than polish or short-term traction. As well as a focus on the potential of the founding team.

Judges consider factors including the quality and differentiation of the idea, the team's willingness to take risks and experiment on-chain, technical execution relative to the project's stage, the strength and crypto-native experience of the builders, and the project's potential to grow into a breakout application on Avalanche.

There are no predefined tracks or categories, and strong projects may look very different from one another. The goal is to surface promising ideas and builders at scale, then support them as they emerge.`
    },
    {
      question: "Can I submit multiple projects?",
      answer: "Yes."
    },
    {
      question: "How do I refer someone?",
      answer: <>1. Click <ReferralLink />{"\n"}2. Share your link everywhere.{"\n\n"}*You cannot refer yourself.</>
    },
    {
      question: "What is the competition timeline?",
      answer: `Applications Open: January 20th
Applications Close: February 13th
Acceptance Letters: Rolling
Competition Begins: February TBA
Finals & Awards: March TBA`
    },
    {
      question: "How does the prize pool work?",
      answer: `The total prize pool is $1,000,000, designed to be flexible and outcome-driven.

Planned allocations:

• $100,000 grand prize
  - $25,000 up front, $75,000 unlocked through milestones

• $75,000 second place
  - $25,000 up front, $50,000 unlocked through milestones

• $50,000 third place
  - $25,000 up front, $25,000 unlocked through milestones

• $30,000 total prize pool for referrals
  - $10,000 if you refer the 1st place winner
  - $7,500 if you refer the 2nd place winner
  - $5,500 if you refer the 3rd place winner
  - $1,000 if you refer a 4th-10th place winner

The remainder of winning projects will be awarded on a case-by-case basis, with total award amounts and any milestone-based unlocks determined individually.`
    }
  ];

  return (
    <div className="gradient-border-section relative rounded-[16px] shrink-0 w-full">
      <div className="content-stretch flex flex-col gap-[16px] items-start p-[24px] relative w-full">
        <div className="content-stretch flex items-start pb-[16px] pt-0 px-0 relative shrink-0 w-full">
          <div className="content-stretch flex flex-col gap-[10px] items-start overflow-clip p-[10px] relative shrink-0">
            <div className="flex flex-col font-['Aeonik:Medium',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[48px] text-white text-nowrap"><p className="leading-none">Frequently Asked Questions</p></div>
          </div>
        </div>
        <div className="w-full">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border-b border-[rgba(102,172,214,0.3)]">
                <AccordionTrigger className="text-white text-[1.5rem] leading-[2] font-['Aeonik:Medium',sans-serif] hover:no-underline py-[20px]">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-[rgba(255,255,255,0.8)] text-[18px] font-['Aeonik:Regular',sans-serif] whitespace-pre-wrap leading-[1.6]">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  );
}

function FinalCTASection() {
  return (
    <div className="gradient-border-section bg-[rgba(102,172,214,0.25)] relative rounded-[16px] shrink-0 w-full">
      <div className="content-stretch flex flex-col gap-[16px] items-start pb-[36px] pt-[24px] px-[24px] relative w-full">
        <div className="content-stretch flex flex-col items-center relative shrink-0 w-full">
          <div className="relative shrink-0 w-full">
            <div className="flex flex-col items-center overflow-clip rounded-[inherit] size-full">
              <div className="content-stretch flex flex-col gap-[10px] p-[10px] relative w-full items-center">
                <div className="flex flex-col font-['Aeonik:Medium',sans-serif] font-medium justify-center leading-[0] not-italic relative shrink-0 text-[64px] text-nowrap text-white">
                  <p className="leading-[80px]">Get Involved</p>
                </div>
              </div>
            </div>
          </div>
          <div className="content-stretch flex items-start justify-between relative shrink-0 w-full">
            <div className="content-stretch flex gap-[10px] items-center justify-center relative shrink-0 w-[1068px]">
              <InfoBanner>
                <div aria-hidden="true" className="absolute border-[#66acd6] border-[0px_0px_0px_4px] border-solid inset-0 pointer-events-none" />
                <p className="font-['Aeonik:Regular',sans-serif] leading-[1.25] not-italic relative shrink-0 text-[18px] text-white w-[401.336px]">
                  Spots are limited and reviewed on a rolling basis.
                </p>
              </InfoBanner>
              <InfoBanner>
                <div aria-hidden="true" className="absolute border-[#66acd6] border-[0px_0px_0px_4px] border-solid inset-0 pointer-events-none" />
                <p className="font-['Aeonik:Regular',sans-serif] leading-[1.25] not-italic relative shrink-0 text-[18px] text-nowrap text-white">
                  Start your next chapter on Avalanche
                </p>
              </InfoBanner>
            </div>
          </div>
          <div className="h-[77px] relative shrink-0 w-full">
            <div className="flex flex-row items-center justify-center overflow-clip rounded-[inherit] size-full">
              <div className="content-stretch flex items-center justify-center relative size-full py-0">
                <div className="content-stretch flex gap-[10px] items-center relative shrink-0">
                  <ReferralButton />
                  <ApplyButton className="content-stretch flex flex-col items-center relative shrink-0 bg-[#66acd6] h-[52px] justify-center px-[36px] py-[12px] rounded-[3.35544e+07px] cursor-pointer hover:bg-[#7bbde3] transition-colors shadow-[0px_0px_20px_4px_rgba(102,172,214,0.5)]">
                    <span className="flex flex-col font-['Aeonik:Medium',sans-serif] font-medium justify-center leading-[0] relative shrink-0 text-[#152d44] text-[18px] text-center text-nowrap">
                      <span className="leading-[28px]">Apply</span>
                    </span>
                  </ApplyButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MainContent() {
  return (
    <div className="absolute content-stretch flex flex-col items-start left-[-0.05px] right-[0.05px] top-0" data-name="Main">
      <HeroSection />
      <HeroTilesSection />
      <ApplicationStatusTracker />
      <div className="relative shrink-0 w-full" data-name="CTA">
        <div className="flex flex-col justify-center size-full">
          <div className="content-stretch flex flex-col gap-[16px] items-start justify-center px-[186px] py-0 relative w-full">
            <WhatIsBuildGamesSection />
            <WhoShouldApplySection />
            <HowItWorksSection />
            <PrizesSection />
            <div className="h-[24px] shrink-0 w-[197px]" data-name="Spacer" />
            <WhatWereLookingForSection />
            <FAQsSection />
            <FinalCTASection />
          </div>
        </div>
      </div>
    </div>
  );
}

function BackgroundDecorationUpper() {
  return (<div className="absolute h-[1045px] left-1/2 -translate-x-1/2 opacity-25 top-[920px] w-full"><BackgroundDecoration /></div>);
}

function BackgroundDecorationLower() {
  return (<div className="absolute h-[1045px] left-1/2 -translate-x-1/2 opacity-25 top-[3138.91px] w-full"><BackgroundDecoration /></div>);
}

export default function BuildGamesPage() {
  return (
    <div className="build-games-container" style={{backgroundImage: "linear-gradient(90deg, rgb(21, 45, 68) 0%, rgb(21, 45, 68) 100%), linear-gradient(90deg, rgb(18, 18, 18) 0%, rgb(18, 18, 18) 100%)"}}>
      <div className="relative w-full" data-name="Landing Page Example">
        <BackgroundDecorationUpper />
        <BackgroundDecorationLower />
        <MainContent />
      </div>
    </div>
  );
}