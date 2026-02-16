export const API = {
  pocket: {
    create: "/api/pocket/create",
    get: (address: string) => `/api/pocket/${address}`,
    assets: (address: string) => `/api/pocket/${address}/assets`,
    exec: "/api/pocket/exec",
    burn: "/api/pocket/burn",
    sweep: "/api/pocket/sweep",
    simulate: "/api/pocket/simulate",
    gas: "/api/pocket/gas",
    fee: "/api/pocket/fee",
    listByUser: (user: string) => `/api/pockets/${user}`,
    decodeCalldata: "/api/calldata/decode"
  },

  controller: {
    pocketInfo: (address: string) => `/api/controller/pocket/${address}`
  },

  verify: {
    execIntent: "/api/verify/exec-intent"
  },

  risk: {
    classify: "/api/risk/classify",
    simulate: "/api/risk/simulate"
  },

  token: {
    info: (address: string) => `/api/token/${address}`
  },

  meta: {
    history: (user: string) => `/api/history/${user}`,
    metrics: "/api/metrics",
    health: "/api/health"
  }
};
