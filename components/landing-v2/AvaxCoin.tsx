/* ------------------------------------------------------------------ */
/* The C-Chain's node in "One network. Two ways to build": the AVAX   */
/* mark on a lit red disc.                                              */
/*                                                                      */
/* A triangle centered by its box looks low, because its weight sits    */
/* in its base. So the mark is placed by geometry, not by flex: the     */
/* point halfway between its box center and its area centroid sits at  */
/* the disc center. The paths are the official logomark                 */
/* (public/common-images/Avalanche_Logomark_Red.svg, 257x227), scaled   */
/* to 56% of the disc's width.                                          */
/* ------------------------------------------------------------------ */

export default function AvaxCoin() {
  return (
    <span aria-hidden className="relative size-12 shrink-0 overflow-hidden rounded-full bg-[radial-gradient(circle_at_34%_26%,#ff5c66_0%,#e6212f_46%,#a10f1a_100%)] shadow-[inset_0_1px_1px_rgb(255_255_255/0.45),inset_0_-3px_5px_rgb(0_0_0/0.3),0_8px_16px_-6px_rgb(230_33_47/0.6),0_1px_2px_rgb(0_0_0/0.25)]">
      {/* the gloss: light falling on the disc's upper half */}
      <span className="absolute inset-x-[16%] top-[5%] h-[42%] rounded-[50%] bg-gradient-to-b from-white/35 to-transparent" />
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 size-full drop-shadow-[0_1px_0.5px_rgb(80_0_8/0.55)]"
        fill="#fff"
      >
        <g transform="translate(22.74 21.83) scale(0.21807)">
          <path d="M160.944 226.789H246.964C254.554 226.789 259.304 218.569 255.504 211.999L212.494 137.509C208.694 130.939 199.214 130.939 195.414 137.509L152.404 211.999C148.604 218.569 153.354 226.789 160.944 226.789Z" />
          <path d="M171.704 66.8581L136.354 5.61809C132.784 -0.571914 123.844 -0.571914 120.274 5.61809L1.38358 211.538C-2.52642 218.318 2.36358 226.778 10.1836 226.778H80.9736C88.5236 226.778 95.4936 222.748 99.2636 216.218L171.704 90.7481C175.974 83.3581 175.974 74.2481 171.704 66.8581Z" />
        </g>
      </svg>
    </span>
  );
}
