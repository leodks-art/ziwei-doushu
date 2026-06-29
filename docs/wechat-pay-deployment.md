# 微信登录与支付上线清单

这份清单用于把当前紫微项目部署到阿里云 ECS，并启用公众号网页授权、微信 JSAPI 支付、付费文档下载和 `/admin-ziwei` 后台。

## 1. 需要你先准备

- 微信公众号 AppID / AppSecret。
- 微信支付商户号、APIv3 密钥、商户 API 证书私钥 `apiclient_key.pem`。
- 微信支付平台公钥或平台证书公钥文件。
- 付费文档文件，例如 `classics-full.zip`。
- 服务器 Postgres 数据库账号密码。

微信后台需要配置：

- 公众号网页授权域名：`luchengdr.com`
- 微信支付通知地址：`https://luchengdr.com/api/pay/wechat/notify`

## 2. 服务器目录建议

```bash
sudo mkdir -p /opt/ziwei-secrets /opt/ziwei-paid-files /var/www/ziwei-doushu
sudo chmod 700 /opt/ziwei-secrets
```

把文件放入：

```text
/opt/ziwei-secrets/apiclient_key.pem
/opt/ziwei-secrets/wechatpay_public_key.pem
/opt/ziwei-paid-files/classics-full.zip
```

## 3. 生产环境变量

在项目根目录创建 `.env.local`：

```env
NEXT_PUBLIC_SITE_URL=https://luchengdr.com

DATABASE_URL=postgres://ziwei:REPLACE_PASSWORD@127.0.0.1:5432/ziwei
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=REPLACE_WITH_HASH
ADMIN_SESSION_SECRET=REPLACE_LONG_RANDOM_SECRET
USER_SESSION_SECRET=REPLACE_LONG_RANDOM_SECRET
LOG_HASH_SALT=REPLACE_LONG_RANDOM_SECRET

WECHAT_OFFICIAL_APPID=wx...
WECHAT_OFFICIAL_SECRET=...

WECHAT_PAY_APPID=wx...
WECHAT_PAY_MCHID=...
WECHAT_PAY_MERCHANT_SERIAL_NO=...
WECHAT_PAY_PRIVATE_KEY_PATH=/opt/ziwei-secrets/apiclient_key.pem
WECHAT_PAY_API_V3_KEY=32位APIv3密钥
WECHAT_PAY_PUBLIC_KEY_PATH=/opt/ziwei-secrets/wechatpay_public_key.pem
WECHAT_PAY_NOTIFY_URL=https://luchengdr.com/api/pay/wechat/notify

PAID_FILE_ROOT=/opt/ziwei-paid-files
```

生成后台密码 hash：

```bash
node scripts/hash-admin-password.mjs '你的强密码'
```

把输出填到 `ADMIN_PASSWORD_HASH`。

## 4. 数据库迁移

```bash
pnpm install --config.confirmModulesPurge=false
pnpm db:migrate
```

迁移会创建：

- `app_users`
- `paid_products`
- `paid_orders`
- `download_events`
- `access_logs`

并插入默认商品 `classics-full`，初始为未上架。

## 5. 构建与启动

```bash
pnpm build
pm2 start "pnpm start -- -H 127.0.0.1 -p 3001" --name ziwei-doushu
pm2 save
```

Nginx 只新增 `luchengdr.com` 站点，不覆盖现有站点：

```nginx
server {
    listen 80;
    server_name luchengdr.com www.luchengdr.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

HTTPS 证书签发后，把微信支付通知地址保持为：

```text
https://luchengdr.com/api/pay/wechat/notify
```

## 6. 上线验证

```bash
curl -I https://luchengdr.com/paid-downloads
curl -I https://luchengdr.com/admin-ziwei/login
curl -s https://luchengdr.com/api/products
```

后台检查：

```text
https://luchengdr.com/admin-ziwei
```

进入后台后：

1. 查看“配置状态”全部为已配置。
2. 商品管理里确认 `classics-full.zip` 文件存在。
3. 设置价格并上架。
4. 用微信打开 `https://luchengdr.com/paid-downloads` 测试授权和支付。

## 7. 注意事项

- 付费文件不要放到 `public/`，只能放在 `PAID_FILE_ROOT`。
- 微信支付回调必须能被公网 HTTPS 访问。
- 如果微信支付回调验签失败，优先检查平台公钥文件、商户号、证书序列号和 APIv3 密钥。
- 如果公众号授权失败，检查公众号后台网页授权域名是否为 `luchengdr.com`，不要带 `https://`。
