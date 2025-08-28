import { User as NextAuthUser} from "next-auth";
import { Badge } from "./badge";

export type User = NextAuthUser & {
    badges: Badge[]
};