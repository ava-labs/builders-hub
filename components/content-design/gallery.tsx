import Image from "next/image";

export default function Gallery({ url1, url2 }: { url1: string; url2: string }) {
  return (
    <div className="row" style={{ display: "flex" }}>
      <div className="column" style={{ position: "relative", flex: 1 }}>
        <Image
          src={url1}
          alt=""
          fill
          style={{ border: "1px solid rgb(220, 220, 220)", objectFit: "contain" }}
        />
      </div>
      <div className="column" style={{ position: "relative", flex: 1 }}>
        <Image
          src={url2}
          alt=""
          fill
          style={{ border: "1px solid rgb(220, 220, 220)", objectFit: "contain" }}
        />
      </div>
    </div>
  );
}
