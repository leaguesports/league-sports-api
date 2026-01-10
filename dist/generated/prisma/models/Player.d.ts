import type * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../internal/prismaNamespace";
/**
 * Model Player
 *
 */
export type PlayerModel = runtime.Types.Result.DefaultSelection<Prisma.$PlayerPayload>;
export type AggregatePlayer = {
    _count: PlayerCountAggregateOutputType | null;
    _min: PlayerMinAggregateOutputType | null;
    _max: PlayerMaxAggregateOutputType | null;
};
export type PlayerMinAggregateOutputType = {
    id: string | null;
};
export type PlayerMaxAggregateOutputType = {
    id: string | null;
};
export type PlayerCountAggregateOutputType = {
    id: number;
    _all: number;
};
export type PlayerMinAggregateInputType = {
    id?: true;
};
export type PlayerMaxAggregateInputType = {
    id?: true;
};
export type PlayerCountAggregateInputType = {
    id?: true;
    _all?: true;
};
export type PlayerAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Filter which Player to aggregate.
     */
    where?: Prisma.PlayerWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Players to fetch.
     */
    orderBy?: Prisma.PlayerOrderByWithRelationInput | Prisma.PlayerOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: Prisma.PlayerWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Players from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Players.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned Players
    **/
    _count?: true | PlayerCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
    **/
    _min?: PlayerMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
    **/
    _max?: PlayerMaxAggregateInputType;
};
export type GetPlayerAggregateType<T extends PlayerAggregateArgs> = {
    [P in keyof T & keyof AggregatePlayer]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregatePlayer[P]> : Prisma.GetScalarType<T[P], AggregatePlayer[P]>;
};
export type PlayerGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.PlayerWhereInput;
    orderBy?: Prisma.PlayerOrderByWithAggregationInput | Prisma.PlayerOrderByWithAggregationInput[];
    by: Prisma.PlayerScalarFieldEnum[] | Prisma.PlayerScalarFieldEnum;
    having?: Prisma.PlayerScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: PlayerCountAggregateInputType | true;
    _min?: PlayerMinAggregateInputType;
    _max?: PlayerMaxAggregateInputType;
};
export type PlayerGroupByOutputType = {
    id: string;
    _count: PlayerCountAggregateOutputType | null;
    _min: PlayerMinAggregateOutputType | null;
    _max: PlayerMaxAggregateOutputType | null;
};
type GetPlayerGroupByPayload<T extends PlayerGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<PlayerGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof PlayerGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], PlayerGroupByOutputType[P]> : Prisma.GetScalarType<T[P], PlayerGroupByOutputType[P]>;
}>>;
export type PlayerWhereInput = {
    AND?: Prisma.PlayerWhereInput | Prisma.PlayerWhereInput[];
    OR?: Prisma.PlayerWhereInput[];
    NOT?: Prisma.PlayerWhereInput | Prisma.PlayerWhereInput[];
    id?: Prisma.StringFilter<"Player"> | string;
    profile?: Prisma.XOR<Prisma.ProfileNullableScalarRelationFilter, Prisma.ProfileWhereInput> | null;
    accounts?: Prisma.AccountListRelationFilter;
    communityMembers?: Prisma.CommunityMemberListRelationFilter;
};
export type PlayerOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    profile?: Prisma.ProfileOrderByWithRelationInput;
    accounts?: Prisma.AccountOrderByRelationAggregateInput;
    communityMembers?: Prisma.CommunityMemberOrderByRelationAggregateInput;
};
export type PlayerWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    AND?: Prisma.PlayerWhereInput | Prisma.PlayerWhereInput[];
    OR?: Prisma.PlayerWhereInput[];
    NOT?: Prisma.PlayerWhereInput | Prisma.PlayerWhereInput[];
    profile?: Prisma.XOR<Prisma.ProfileNullableScalarRelationFilter, Prisma.ProfileWhereInput> | null;
    accounts?: Prisma.AccountListRelationFilter;
    communityMembers?: Prisma.CommunityMemberListRelationFilter;
}, "id">;
export type PlayerOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    _count?: Prisma.PlayerCountOrderByAggregateInput;
    _max?: Prisma.PlayerMaxOrderByAggregateInput;
    _min?: Prisma.PlayerMinOrderByAggregateInput;
};
export type PlayerScalarWhereWithAggregatesInput = {
    AND?: Prisma.PlayerScalarWhereWithAggregatesInput | Prisma.PlayerScalarWhereWithAggregatesInput[];
    OR?: Prisma.PlayerScalarWhereWithAggregatesInput[];
    NOT?: Prisma.PlayerScalarWhereWithAggregatesInput | Prisma.PlayerScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<"Player"> | string;
};
export type PlayerCreateInput = {
    id?: string;
    profile?: Prisma.ProfileCreateNestedOneWithoutPlayerInput;
    accounts?: Prisma.AccountCreateNestedManyWithoutPlayerInput;
    communityMembers?: Prisma.CommunityMemberCreateNestedManyWithoutPlayerInput;
};
export type PlayerUncheckedCreateInput = {
    id?: string;
    profile?: Prisma.ProfileUncheckedCreateNestedOneWithoutPlayerInput;
    accounts?: Prisma.AccountUncheckedCreateNestedManyWithoutPlayerInput;
    communityMembers?: Prisma.CommunityMemberUncheckedCreateNestedManyWithoutPlayerInput;
};
export type PlayerUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    profile?: Prisma.ProfileUpdateOneWithoutPlayerNestedInput;
    accounts?: Prisma.AccountUpdateManyWithoutPlayerNestedInput;
    communityMembers?: Prisma.CommunityMemberUpdateManyWithoutPlayerNestedInput;
};
export type PlayerUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    profile?: Prisma.ProfileUncheckedUpdateOneWithoutPlayerNestedInput;
    accounts?: Prisma.AccountUncheckedUpdateManyWithoutPlayerNestedInput;
    communityMembers?: Prisma.CommunityMemberUncheckedUpdateManyWithoutPlayerNestedInput;
};
export type PlayerCreateManyInput = {
    id?: string;
};
export type PlayerUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
};
export type PlayerUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
};
export type PlayerCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
};
export type PlayerMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
};
export type PlayerMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
};
export type PlayerScalarRelationFilter = {
    is?: Prisma.PlayerWhereInput;
    isNot?: Prisma.PlayerWhereInput;
};
export type StringFieldUpdateOperationsInput = {
    set?: string;
};
export type PlayerCreateNestedOneWithoutAccountsInput = {
    create?: Prisma.XOR<Prisma.PlayerCreateWithoutAccountsInput, Prisma.PlayerUncheckedCreateWithoutAccountsInput>;
    connectOrCreate?: Prisma.PlayerCreateOrConnectWithoutAccountsInput;
    connect?: Prisma.PlayerWhereUniqueInput;
};
export type PlayerUpdateOneRequiredWithoutAccountsNestedInput = {
    create?: Prisma.XOR<Prisma.PlayerCreateWithoutAccountsInput, Prisma.PlayerUncheckedCreateWithoutAccountsInput>;
    connectOrCreate?: Prisma.PlayerCreateOrConnectWithoutAccountsInput;
    upsert?: Prisma.PlayerUpsertWithoutAccountsInput;
    connect?: Prisma.PlayerWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.PlayerUpdateToOneWithWhereWithoutAccountsInput, Prisma.PlayerUpdateWithoutAccountsInput>, Prisma.PlayerUncheckedUpdateWithoutAccountsInput>;
};
export type PlayerCreateNestedOneWithoutProfileInput = {
    create?: Prisma.XOR<Prisma.PlayerCreateWithoutProfileInput, Prisma.PlayerUncheckedCreateWithoutProfileInput>;
    connectOrCreate?: Prisma.PlayerCreateOrConnectWithoutProfileInput;
    connect?: Prisma.PlayerWhereUniqueInput;
};
export type PlayerUpdateOneRequiredWithoutProfileNestedInput = {
    create?: Prisma.XOR<Prisma.PlayerCreateWithoutProfileInput, Prisma.PlayerUncheckedCreateWithoutProfileInput>;
    connectOrCreate?: Prisma.PlayerCreateOrConnectWithoutProfileInput;
    upsert?: Prisma.PlayerUpsertWithoutProfileInput;
    connect?: Prisma.PlayerWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.PlayerUpdateToOneWithWhereWithoutProfileInput, Prisma.PlayerUpdateWithoutProfileInput>, Prisma.PlayerUncheckedUpdateWithoutProfileInput>;
};
export type PlayerCreateNestedOneWithoutCommunityMembersInput = {
    create?: Prisma.XOR<Prisma.PlayerCreateWithoutCommunityMembersInput, Prisma.PlayerUncheckedCreateWithoutCommunityMembersInput>;
    connectOrCreate?: Prisma.PlayerCreateOrConnectWithoutCommunityMembersInput;
    connect?: Prisma.PlayerWhereUniqueInput;
};
export type PlayerUpdateOneRequiredWithoutCommunityMembersNestedInput = {
    create?: Prisma.XOR<Prisma.PlayerCreateWithoutCommunityMembersInput, Prisma.PlayerUncheckedCreateWithoutCommunityMembersInput>;
    connectOrCreate?: Prisma.PlayerCreateOrConnectWithoutCommunityMembersInput;
    upsert?: Prisma.PlayerUpsertWithoutCommunityMembersInput;
    connect?: Prisma.PlayerWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.PlayerUpdateToOneWithWhereWithoutCommunityMembersInput, Prisma.PlayerUpdateWithoutCommunityMembersInput>, Prisma.PlayerUncheckedUpdateWithoutCommunityMembersInput>;
};
export type PlayerCreateWithoutAccountsInput = {
    id?: string;
    profile?: Prisma.ProfileCreateNestedOneWithoutPlayerInput;
    communityMembers?: Prisma.CommunityMemberCreateNestedManyWithoutPlayerInput;
};
export type PlayerUncheckedCreateWithoutAccountsInput = {
    id?: string;
    profile?: Prisma.ProfileUncheckedCreateNestedOneWithoutPlayerInput;
    communityMembers?: Prisma.CommunityMemberUncheckedCreateNestedManyWithoutPlayerInput;
};
export type PlayerCreateOrConnectWithoutAccountsInput = {
    where: Prisma.PlayerWhereUniqueInput;
    create: Prisma.XOR<Prisma.PlayerCreateWithoutAccountsInput, Prisma.PlayerUncheckedCreateWithoutAccountsInput>;
};
export type PlayerUpsertWithoutAccountsInput = {
    update: Prisma.XOR<Prisma.PlayerUpdateWithoutAccountsInput, Prisma.PlayerUncheckedUpdateWithoutAccountsInput>;
    create: Prisma.XOR<Prisma.PlayerCreateWithoutAccountsInput, Prisma.PlayerUncheckedCreateWithoutAccountsInput>;
    where?: Prisma.PlayerWhereInput;
};
export type PlayerUpdateToOneWithWhereWithoutAccountsInput = {
    where?: Prisma.PlayerWhereInput;
    data: Prisma.XOR<Prisma.PlayerUpdateWithoutAccountsInput, Prisma.PlayerUncheckedUpdateWithoutAccountsInput>;
};
export type PlayerUpdateWithoutAccountsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    profile?: Prisma.ProfileUpdateOneWithoutPlayerNestedInput;
    communityMembers?: Prisma.CommunityMemberUpdateManyWithoutPlayerNestedInput;
};
export type PlayerUncheckedUpdateWithoutAccountsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    profile?: Prisma.ProfileUncheckedUpdateOneWithoutPlayerNestedInput;
    communityMembers?: Prisma.CommunityMemberUncheckedUpdateManyWithoutPlayerNestedInput;
};
export type PlayerCreateWithoutProfileInput = {
    id?: string;
    accounts?: Prisma.AccountCreateNestedManyWithoutPlayerInput;
    communityMembers?: Prisma.CommunityMemberCreateNestedManyWithoutPlayerInput;
};
export type PlayerUncheckedCreateWithoutProfileInput = {
    id?: string;
    accounts?: Prisma.AccountUncheckedCreateNestedManyWithoutPlayerInput;
    communityMembers?: Prisma.CommunityMemberUncheckedCreateNestedManyWithoutPlayerInput;
};
export type PlayerCreateOrConnectWithoutProfileInput = {
    where: Prisma.PlayerWhereUniqueInput;
    create: Prisma.XOR<Prisma.PlayerCreateWithoutProfileInput, Prisma.PlayerUncheckedCreateWithoutProfileInput>;
};
export type PlayerUpsertWithoutProfileInput = {
    update: Prisma.XOR<Prisma.PlayerUpdateWithoutProfileInput, Prisma.PlayerUncheckedUpdateWithoutProfileInput>;
    create: Prisma.XOR<Prisma.PlayerCreateWithoutProfileInput, Prisma.PlayerUncheckedCreateWithoutProfileInput>;
    where?: Prisma.PlayerWhereInput;
};
export type PlayerUpdateToOneWithWhereWithoutProfileInput = {
    where?: Prisma.PlayerWhereInput;
    data: Prisma.XOR<Prisma.PlayerUpdateWithoutProfileInput, Prisma.PlayerUncheckedUpdateWithoutProfileInput>;
};
export type PlayerUpdateWithoutProfileInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    accounts?: Prisma.AccountUpdateManyWithoutPlayerNestedInput;
    communityMembers?: Prisma.CommunityMemberUpdateManyWithoutPlayerNestedInput;
};
export type PlayerUncheckedUpdateWithoutProfileInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    accounts?: Prisma.AccountUncheckedUpdateManyWithoutPlayerNestedInput;
    communityMembers?: Prisma.CommunityMemberUncheckedUpdateManyWithoutPlayerNestedInput;
};
export type PlayerCreateWithoutCommunityMembersInput = {
    id?: string;
    profile?: Prisma.ProfileCreateNestedOneWithoutPlayerInput;
    accounts?: Prisma.AccountCreateNestedManyWithoutPlayerInput;
};
export type PlayerUncheckedCreateWithoutCommunityMembersInput = {
    id?: string;
    profile?: Prisma.ProfileUncheckedCreateNestedOneWithoutPlayerInput;
    accounts?: Prisma.AccountUncheckedCreateNestedManyWithoutPlayerInput;
};
export type PlayerCreateOrConnectWithoutCommunityMembersInput = {
    where: Prisma.PlayerWhereUniqueInput;
    create: Prisma.XOR<Prisma.PlayerCreateWithoutCommunityMembersInput, Prisma.PlayerUncheckedCreateWithoutCommunityMembersInput>;
};
export type PlayerUpsertWithoutCommunityMembersInput = {
    update: Prisma.XOR<Prisma.PlayerUpdateWithoutCommunityMembersInput, Prisma.PlayerUncheckedUpdateWithoutCommunityMembersInput>;
    create: Prisma.XOR<Prisma.PlayerCreateWithoutCommunityMembersInput, Prisma.PlayerUncheckedCreateWithoutCommunityMembersInput>;
    where?: Prisma.PlayerWhereInput;
};
export type PlayerUpdateToOneWithWhereWithoutCommunityMembersInput = {
    where?: Prisma.PlayerWhereInput;
    data: Prisma.XOR<Prisma.PlayerUpdateWithoutCommunityMembersInput, Prisma.PlayerUncheckedUpdateWithoutCommunityMembersInput>;
};
export type PlayerUpdateWithoutCommunityMembersInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    profile?: Prisma.ProfileUpdateOneWithoutPlayerNestedInput;
    accounts?: Prisma.AccountUpdateManyWithoutPlayerNestedInput;
};
export type PlayerUncheckedUpdateWithoutCommunityMembersInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    profile?: Prisma.ProfileUncheckedUpdateOneWithoutPlayerNestedInput;
    accounts?: Prisma.AccountUncheckedUpdateManyWithoutPlayerNestedInput;
};
/**
 * Count Type PlayerCountOutputType
 */
export type PlayerCountOutputType = {
    accounts: number;
    communityMembers: number;
};
export type PlayerCountOutputTypeSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    accounts?: boolean | PlayerCountOutputTypeCountAccountsArgs;
    communityMembers?: boolean | PlayerCountOutputTypeCountCommunityMembersArgs;
};
/**
 * PlayerCountOutputType without action
 */
export type PlayerCountOutputTypeDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlayerCountOutputType
     */
    select?: Prisma.PlayerCountOutputTypeSelect<ExtArgs> | null;
};
/**
 * PlayerCountOutputType without action
 */
export type PlayerCountOutputTypeCountAccountsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.AccountWhereInput;
};
/**
 * PlayerCountOutputType without action
 */
export type PlayerCountOutputTypeCountCommunityMembersArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.CommunityMemberWhereInput;
};
export type PlayerSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    profile?: boolean | Prisma.Player$profileArgs<ExtArgs>;
    accounts?: boolean | Prisma.Player$accountsArgs<ExtArgs>;
    communityMembers?: boolean | Prisma.Player$communityMembersArgs<ExtArgs>;
    _count?: boolean | Prisma.PlayerCountOutputTypeDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["player"]>;
export type PlayerSelectCreateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
}, ExtArgs["result"]["player"]>;
export type PlayerSelectUpdateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
}, ExtArgs["result"]["player"]>;
export type PlayerSelectScalar = {
    id?: boolean;
};
export type PlayerOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id", ExtArgs["result"]["player"]>;
export type PlayerInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    profile?: boolean | Prisma.Player$profileArgs<ExtArgs>;
    accounts?: boolean | Prisma.Player$accountsArgs<ExtArgs>;
    communityMembers?: boolean | Prisma.Player$communityMembersArgs<ExtArgs>;
    _count?: boolean | Prisma.PlayerCountOutputTypeDefaultArgs<ExtArgs>;
};
export type PlayerIncludeCreateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {};
export type PlayerIncludeUpdateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {};
export type $PlayerPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "Player";
    objects: {
        profile: Prisma.$ProfilePayload<ExtArgs> | null;
        accounts: Prisma.$AccountPayload<ExtArgs>[];
        communityMembers: Prisma.$CommunityMemberPayload<ExtArgs>[];
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
    }, ExtArgs["result"]["player"]>;
    composites: {};
};
export type PlayerGetPayload<S extends boolean | null | undefined | PlayerDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$PlayerPayload, S>;
export type PlayerCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<PlayerFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: PlayerCountAggregateInputType | true;
};
export interface PlayerDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['Player'];
        meta: {
            name: 'Player';
        };
    };
    /**
     * Find zero or one Player that matches the filter.
     * @param {PlayerFindUniqueArgs} args - Arguments to find a Player
     * @example
     * // Get one Player
     * const player = await prisma.player.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PlayerFindUniqueArgs>(args: Prisma.SelectSubset<T, PlayerFindUniqueArgs<ExtArgs>>): Prisma.Prisma__PlayerClient<runtime.Types.Result.GetResult<Prisma.$PlayerPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    /**
     * Find one Player that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PlayerFindUniqueOrThrowArgs} args - Arguments to find a Player
     * @example
     * // Get one Player
     * const player = await prisma.player.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PlayerFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, PlayerFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__PlayerClient<runtime.Types.Result.GetResult<Prisma.$PlayerPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Find the first Player that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlayerFindFirstArgs} args - Arguments to find a Player
     * @example
     * // Get one Player
     * const player = await prisma.player.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PlayerFindFirstArgs>(args?: Prisma.SelectSubset<T, PlayerFindFirstArgs<ExtArgs>>): Prisma.Prisma__PlayerClient<runtime.Types.Result.GetResult<Prisma.$PlayerPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    /**
     * Find the first Player that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlayerFindFirstOrThrowArgs} args - Arguments to find a Player
     * @example
     * // Get one Player
     * const player = await prisma.player.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PlayerFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, PlayerFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__PlayerClient<runtime.Types.Result.GetResult<Prisma.$PlayerPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Find zero or more Players that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlayerFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Players
     * const players = await prisma.player.findMany()
     *
     * // Get first 10 Players
     * const players = await prisma.player.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const playerWithIdOnly = await prisma.player.findMany({ select: { id: true } })
     *
     */
    findMany<T extends PlayerFindManyArgs>(args?: Prisma.SelectSubset<T, PlayerFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$PlayerPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    /**
     * Create a Player.
     * @param {PlayerCreateArgs} args - Arguments to create a Player.
     * @example
     * // Create one Player
     * const Player = await prisma.player.create({
     *   data: {
     *     // ... data to create a Player
     *   }
     * })
     *
     */
    create<T extends PlayerCreateArgs>(args: Prisma.SelectSubset<T, PlayerCreateArgs<ExtArgs>>): Prisma.Prisma__PlayerClient<runtime.Types.Result.GetResult<Prisma.$PlayerPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Create many Players.
     * @param {PlayerCreateManyArgs} args - Arguments to create many Players.
     * @example
     * // Create many Players
     * const player = await prisma.player.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends PlayerCreateManyArgs>(args?: Prisma.SelectSubset<T, PlayerCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    /**
     * Create many Players and returns the data saved in the database.
     * @param {PlayerCreateManyAndReturnArgs} args - Arguments to create many Players.
     * @example
     * // Create many Players
     * const player = await prisma.player.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many Players and only return the `id`
     * const playerWithIdOnly = await prisma.player.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends PlayerCreateManyAndReturnArgs>(args?: Prisma.SelectSubset<T, PlayerCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$PlayerPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>;
    /**
     * Delete a Player.
     * @param {PlayerDeleteArgs} args - Arguments to delete one Player.
     * @example
     * // Delete one Player
     * const Player = await prisma.player.delete({
     *   where: {
     *     // ... filter to delete one Player
     *   }
     * })
     *
     */
    delete<T extends PlayerDeleteArgs>(args: Prisma.SelectSubset<T, PlayerDeleteArgs<ExtArgs>>): Prisma.Prisma__PlayerClient<runtime.Types.Result.GetResult<Prisma.$PlayerPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Update one Player.
     * @param {PlayerUpdateArgs} args - Arguments to update one Player.
     * @example
     * // Update one Player
     * const player = await prisma.player.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends PlayerUpdateArgs>(args: Prisma.SelectSubset<T, PlayerUpdateArgs<ExtArgs>>): Prisma.Prisma__PlayerClient<runtime.Types.Result.GetResult<Prisma.$PlayerPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Delete zero or more Players.
     * @param {PlayerDeleteManyArgs} args - Arguments to filter Players to delete.
     * @example
     * // Delete a few Players
     * const { count } = await prisma.player.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends PlayerDeleteManyArgs>(args?: Prisma.SelectSubset<T, PlayerDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    /**
     * Update zero or more Players.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlayerUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Players
     * const player = await prisma.player.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends PlayerUpdateManyArgs>(args: Prisma.SelectSubset<T, PlayerUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    /**
     * Update zero or more Players and returns the data updated in the database.
     * @param {PlayerUpdateManyAndReturnArgs} args - Arguments to update many Players.
     * @example
     * // Update many Players
     * const player = await prisma.player.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more Players and only return the `id`
     * const playerWithIdOnly = await prisma.player.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    updateManyAndReturn<T extends PlayerUpdateManyAndReturnArgs>(args: Prisma.SelectSubset<T, PlayerUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$PlayerPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>;
    /**
     * Create or update one Player.
     * @param {PlayerUpsertArgs} args - Arguments to update or create a Player.
     * @example
     * // Update or create a Player
     * const player = await prisma.player.upsert({
     *   create: {
     *     // ... data to create a Player
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Player we want to update
     *   }
     * })
     */
    upsert<T extends PlayerUpsertArgs>(args: Prisma.SelectSubset<T, PlayerUpsertArgs<ExtArgs>>): Prisma.Prisma__PlayerClient<runtime.Types.Result.GetResult<Prisma.$PlayerPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Count the number of Players.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlayerCountArgs} args - Arguments to filter Players to count.
     * @example
     * // Count the number of Players
     * const count = await prisma.player.count({
     *   where: {
     *     // ... the filter for the Players we want to count
     *   }
     * })
    **/
    count<T extends PlayerCountArgs>(args?: Prisma.Subset<T, PlayerCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], PlayerCountAggregateOutputType> : number>;
    /**
     * Allows you to perform aggregations operations on a Player.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlayerAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PlayerAggregateArgs>(args: Prisma.Subset<T, PlayerAggregateArgs>): Prisma.PrismaPromise<GetPlayerAggregateType<T>>;
    /**
     * Group by Player.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlayerGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
    **/
    groupBy<T extends PlayerGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: PlayerGroupByArgs['orderBy'];
    } : {
        orderBy?: PlayerGroupByArgs['orderBy'];
    }, OrderFields extends Prisma.ExcludeUnderscoreKeys<Prisma.Keys<Prisma.MaybeTupleToUnion<T['orderBy']>>>, ByFields extends Prisma.MaybeTupleToUnion<T['by']>, ByValid extends Prisma.Has<ByFields, OrderFields>, HavingFields extends Prisma.GetHavingFields<T['having']>, HavingValid extends Prisma.Has<ByFields, HavingFields>, ByEmpty extends T['by'] extends never[] ? Prisma.True : Prisma.False, InputErrors extends ByEmpty extends Prisma.True ? `Error: "by" must not be empty.` : HavingValid extends Prisma.False ? {
        [P in HavingFields]: P extends ByFields ? never : P extends string ? `Error: Field "${P}" used in "having" needs to be provided in "by".` : [
            Error,
            'Field ',
            P,
            ` in "having" needs to be provided in "by"`
        ];
    }[HavingFields] : 'take' extends Prisma.Keys<T> ? 'orderBy' extends Prisma.Keys<T> ? ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields] : 'Error: If you provide "take", you also need to provide "orderBy"' : 'skip' extends Prisma.Keys<T> ? 'orderBy' extends Prisma.Keys<T> ? ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields] : 'Error: If you provide "skip", you also need to provide "orderBy"' : ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, PlayerGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPlayerGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the Player model
     */
    readonly fields: PlayerFieldRefs;
}
/**
 * The delegate class that acts as a "Promise-like" for Player.
 * Why is this prefixed with `Prisma__`?
 * Because we want to prevent naming conflicts as mentioned in
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export interface Prisma__PlayerClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    profile<T extends Prisma.Player$profileArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.Player$profileArgs<ExtArgs>>): Prisma.Prisma__ProfileClient<runtime.Types.Result.GetResult<Prisma.$ProfilePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    accounts<T extends Prisma.Player$accountsArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.Player$accountsArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$AccountPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    communityMembers<T extends Prisma.Player$communityMembersArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.Player$communityMembersArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$CommunityMemberPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
/**
 * Fields of the Player model
 */
export interface PlayerFieldRefs {
    readonly id: Prisma.FieldRef<"Player", 'String'>;
}
/**
 * Player findUnique
 */
export type PlayerFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Player
     */
    select?: Prisma.PlayerSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Player
     */
    omit?: Prisma.PlayerOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.PlayerInclude<ExtArgs> | null;
    /**
     * Filter, which Player to fetch.
     */
    where: Prisma.PlayerWhereUniqueInput;
};
/**
 * Player findUniqueOrThrow
 */
export type PlayerFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Player
     */
    select?: Prisma.PlayerSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Player
     */
    omit?: Prisma.PlayerOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.PlayerInclude<ExtArgs> | null;
    /**
     * Filter, which Player to fetch.
     */
    where: Prisma.PlayerWhereUniqueInput;
};
/**
 * Player findFirst
 */
export type PlayerFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Player
     */
    select?: Prisma.PlayerSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Player
     */
    omit?: Prisma.PlayerOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.PlayerInclude<ExtArgs> | null;
    /**
     * Filter, which Player to fetch.
     */
    where?: Prisma.PlayerWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Players to fetch.
     */
    orderBy?: Prisma.PlayerOrderByWithRelationInput | Prisma.PlayerOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for Players.
     */
    cursor?: Prisma.PlayerWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Players from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Players.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Players.
     */
    distinct?: Prisma.PlayerScalarFieldEnum | Prisma.PlayerScalarFieldEnum[];
};
/**
 * Player findFirstOrThrow
 */
export type PlayerFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Player
     */
    select?: Prisma.PlayerSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Player
     */
    omit?: Prisma.PlayerOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.PlayerInclude<ExtArgs> | null;
    /**
     * Filter, which Player to fetch.
     */
    where?: Prisma.PlayerWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Players to fetch.
     */
    orderBy?: Prisma.PlayerOrderByWithRelationInput | Prisma.PlayerOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for Players.
     */
    cursor?: Prisma.PlayerWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Players from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Players.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Players.
     */
    distinct?: Prisma.PlayerScalarFieldEnum | Prisma.PlayerScalarFieldEnum[];
};
/**
 * Player findMany
 */
export type PlayerFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Player
     */
    select?: Prisma.PlayerSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Player
     */
    omit?: Prisma.PlayerOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.PlayerInclude<ExtArgs> | null;
    /**
     * Filter, which Players to fetch.
     */
    where?: Prisma.PlayerWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Players to fetch.
     */
    orderBy?: Prisma.PlayerOrderByWithRelationInput | Prisma.PlayerOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing Players.
     */
    cursor?: Prisma.PlayerWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Players from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Players.
     */
    skip?: number;
    distinct?: Prisma.PlayerScalarFieldEnum | Prisma.PlayerScalarFieldEnum[];
};
/**
 * Player create
 */
export type PlayerCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Player
     */
    select?: Prisma.PlayerSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Player
     */
    omit?: Prisma.PlayerOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.PlayerInclude<ExtArgs> | null;
    /**
     * The data needed to create a Player.
     */
    data?: Prisma.XOR<Prisma.PlayerCreateInput, Prisma.PlayerUncheckedCreateInput>;
};
/**
 * Player createMany
 */
export type PlayerCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * The data used to create many Players.
     */
    data: Prisma.PlayerCreateManyInput | Prisma.PlayerCreateManyInput[];
    skipDuplicates?: boolean;
};
/**
 * Player createManyAndReturn
 */
export type PlayerCreateManyAndReturnArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Player
     */
    select?: Prisma.PlayerSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the Player
     */
    omit?: Prisma.PlayerOmit<ExtArgs> | null;
    /**
     * The data used to create many Players.
     */
    data: Prisma.PlayerCreateManyInput | Prisma.PlayerCreateManyInput[];
    skipDuplicates?: boolean;
};
/**
 * Player update
 */
export type PlayerUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Player
     */
    select?: Prisma.PlayerSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Player
     */
    omit?: Prisma.PlayerOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.PlayerInclude<ExtArgs> | null;
    /**
     * The data needed to update a Player.
     */
    data: Prisma.XOR<Prisma.PlayerUpdateInput, Prisma.PlayerUncheckedUpdateInput>;
    /**
     * Choose, which Player to update.
     */
    where: Prisma.PlayerWhereUniqueInput;
};
/**
 * Player updateMany
 */
export type PlayerUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * The data used to update Players.
     */
    data: Prisma.XOR<Prisma.PlayerUpdateManyMutationInput, Prisma.PlayerUncheckedUpdateManyInput>;
    /**
     * Filter which Players to update
     */
    where?: Prisma.PlayerWhereInput;
    /**
     * Limit how many Players to update.
     */
    limit?: number;
};
/**
 * Player updateManyAndReturn
 */
export type PlayerUpdateManyAndReturnArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Player
     */
    select?: Prisma.PlayerSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the Player
     */
    omit?: Prisma.PlayerOmit<ExtArgs> | null;
    /**
     * The data used to update Players.
     */
    data: Prisma.XOR<Prisma.PlayerUpdateManyMutationInput, Prisma.PlayerUncheckedUpdateManyInput>;
    /**
     * Filter which Players to update
     */
    where?: Prisma.PlayerWhereInput;
    /**
     * Limit how many Players to update.
     */
    limit?: number;
};
/**
 * Player upsert
 */
export type PlayerUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Player
     */
    select?: Prisma.PlayerSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Player
     */
    omit?: Prisma.PlayerOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.PlayerInclude<ExtArgs> | null;
    /**
     * The filter to search for the Player to update in case it exists.
     */
    where: Prisma.PlayerWhereUniqueInput;
    /**
     * In case the Player found by the `where` argument doesn't exist, create a new Player with this data.
     */
    create: Prisma.XOR<Prisma.PlayerCreateInput, Prisma.PlayerUncheckedCreateInput>;
    /**
     * In case the Player was found with the provided `where` argument, update it with this data.
     */
    update: Prisma.XOR<Prisma.PlayerUpdateInput, Prisma.PlayerUncheckedUpdateInput>;
};
/**
 * Player delete
 */
export type PlayerDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Player
     */
    select?: Prisma.PlayerSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Player
     */
    omit?: Prisma.PlayerOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.PlayerInclude<ExtArgs> | null;
    /**
     * Filter which Player to delete.
     */
    where: Prisma.PlayerWhereUniqueInput;
};
/**
 * Player deleteMany
 */
export type PlayerDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Filter which Players to delete
     */
    where?: Prisma.PlayerWhereInput;
    /**
     * Limit how many Players to delete.
     */
    limit?: number;
};
/**
 * Player.profile
 */
export type Player$profileArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Profile
     */
    select?: Prisma.ProfileSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Profile
     */
    omit?: Prisma.ProfileOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.ProfileInclude<ExtArgs> | null;
    where?: Prisma.ProfileWhereInput;
};
/**
 * Player.accounts
 */
export type Player$accountsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Account
     */
    select?: Prisma.AccountSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Account
     */
    omit?: Prisma.AccountOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.AccountInclude<ExtArgs> | null;
    where?: Prisma.AccountWhereInput;
    orderBy?: Prisma.AccountOrderByWithRelationInput | Prisma.AccountOrderByWithRelationInput[];
    cursor?: Prisma.AccountWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.AccountScalarFieldEnum | Prisma.AccountScalarFieldEnum[];
};
/**
 * Player.communityMembers
 */
export type Player$communityMembersArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CommunityMember
     */
    select?: Prisma.CommunityMemberSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the CommunityMember
     */
    omit?: Prisma.CommunityMemberOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.CommunityMemberInclude<ExtArgs> | null;
    where?: Prisma.CommunityMemberWhereInput;
    orderBy?: Prisma.CommunityMemberOrderByWithRelationInput | Prisma.CommunityMemberOrderByWithRelationInput[];
    cursor?: Prisma.CommunityMemberWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.CommunityMemberScalarFieldEnum | Prisma.CommunityMemberScalarFieldEnum[];
};
/**
 * Player without action
 */
export type PlayerDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Player
     */
    select?: Prisma.PlayerSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Player
     */
    omit?: Prisma.PlayerOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.PlayerInclude<ExtArgs> | null;
};
export {};
//# sourceMappingURL=Player.d.ts.map