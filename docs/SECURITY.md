# SECURITY

- Encrypt WB API token at rest
- Role-based access
- Action approval
- Audit log
- Rate limit
- Khong luu cookie Wildberries
- Khong tu dong gui request nguy hiem khi chua approve
- Khong expose token sang extension

## MVP implementation

- Token duoc ma hoa AES-256-CBC o backend.
- JWT auth cho dashboard va extension.
- Action nguy hiem can approve va confirm lan 2.
- Tat ca approve, reject, execute deu ghi audit log.
- WB API token khong bao gio duoc tra ve frontend hoac extension sau khi connect.
- Dashboard chi gui token len backend cho flow test/connect.
- Extension chi luu backend JWT, khong luu WB token.
- Khi WB API that loi, chi log status/message can thiet; khong log secret.
