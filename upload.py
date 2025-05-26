import os
import argparse
import pathlib
from typing import *
import json

try:
    import oss2
except:
    os.system("pip install oss2")
    import oss2

cdn_map = {
    'test': {
        'oss_bucket':'test-sunjun',
        'cdn_bucket': 'https://test-sunjun.oss-cn-shanghai.aliyuncs.com'
    },

}

def make_bucket(args):
    cdn_type = args.cdn_type
    endpoint = 'http://oss-cn-shanghai-internal.aliyuncs.com'  # Suppose that your bucket is in the Hangzhou region.
    bucket_name = cdn_map[cdn_type]['oss_bucket']

    auth_config_content = open('upload_config.json', 'r', encoding='utf-8').read()
    auth_config = json.loads(auth_config_content)
    auth = oss2.Auth(auth_config['secret_id'], auth_config['secret_key'])

    bucket = oss2.Bucket(auth, endpoint, bucket_name)
    return bucket

def upload(args):
    bucket = make_bucket(args)

    folder_root = pathlib.Path(args.folder)

    to_upload_list: List[Tuple[str, pathlib.Path]] = []

    def foreach(p: pathlib.Path):
        if p.is_dir():
            for it in p.iterdir():
                foreach(it)
        elif p.is_file():
            key = str(p.relative_to(folder_root).as_posix())
            to_upload_list.append((key, p))

    foreach(folder_root)

    for i in range(len(to_upload_list)):
        elem = to_upload_list[i]

        full_key = f"{args.package_name}/{args.version}/{elem[0]}"
        print(f"[{i+1}/{len(to_upload_list)}] {str(elem[1])}")
        r = bucket.put_object(full_key, open(str(elem[1]), "rb").read())
        if int(r.status / 100) != 2:
            raise Exception(f"upload failed, status: {r.status}, resp: {r.resp}, request_id: {r.request_id}, full_key[{full_key}]")

    print(f'folder url: {cdn_map[args.cdn_type]["cdn_bucket"]}/{args.package_name}/{args.version}/')
    print('upload all success')


def delete(args):
    bucket = make_bucket(args)

    while True:
        r: oss2.models.ListObjectsResult = bucket.list_objects(f"{args.package_name}/{args.version}")
        if int(r.status / 100) != 2:
            raise Exception(f"delete failed , list_object failed, status[{r.status}], resp[{r.resp}]")

        if len(r.object_list) == 0:
            break

        for elem in r.object_list:  # type: oss2.models.SimplifiedObjectInfo
            print(f'delete {elem.key}')
            r2 = bucket.delete_object(elem.key)
            if int(r2.status / 100) != 2:
                raise Exception(f"delete_object failed, status[{r.status}], resp[{r.resp}]")

    print('delete finish')

def _list(args):
    path = args.path
    if len(path) > 0 and path[-1] != '/':
        path = path + '/'
    if path == '/':
        path = ''

    bucket = make_bucket(args)
    r: oss2.models.ListObjectsResult = bucket.list_objects(f"{path}", delimiter='/')

    if int(r.status / 100) != 2:
        raise Exception(f"query list failed , list_object failed, status[{r.status}], resp[{r.resp}]")

    for elem in r.prefix_list:
        print(elem)

    for elem in r.object_list:  # type: oss2.models.SimplifiedObjectInfo
        print(elem.key)


def simple_put(args):
    bucket = make_bucket(args)
    data = args.data
    if args.filepath:
        data = open(args.filepath, 'rb').read()
    r = bucket.put_object(args.path, data)
    if int(r.status / 100) != 2:
        resp = r.resp  # type: oss2.http.Response
        body = ''
        for chunk in resp:
            body += chunk

        raise Exception(f"query list failed , list_object failed, status[{r.status}], resp[{body}]")
    print('simple_put success')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--oss_auth_config', type=str, default='oss_auth_config.json')
    parser.add_argument("--cdn_type", type=str, choices=['test', 'pd'], help='目前只能选test', default='test')
    subparsers = parser.add_subparsers(title="cmd", dest="command")

    parser_upload = subparsers.add_parser("upload")
    # parser_upload.add_argument("cmd", type=str)

    parser_upload.add_argument("--package_name", type=str, help='大致是游戏名的意思')
    parser_upload.add_argument('--version', type=str, help='这是个字符串, 可以用自然数, 比如(1), 也可以是sha1, 随意')
    parser_upload.add_argument("--folder", type=str, help='你要上传的folder')
    parser_upload.set_defaults(func=upload)

    parser_delete = subparsers.add_parser("delete")
    parser_delete.add_argument("--package_name", type=str, help='大致是游戏名的意思')
    parser_delete.add_argument('--version', type=str, help='这是个字符串, 可以用自然数, 比如(1), 也可以是sha1, 随意')
    parser_delete.set_defaults(func=delete)

    parser_list = subparsers.add_parser("list")
    parser_list.add_argument('--path', type=str, help='要查询的path, 如果查第一级, 传空字符串""', default='/')
    parser_list.set_defaults(func=_list)

    parser_simple_put = subparsers.add_parser("simple_put")
    parser_simple_put.add_argument('--path', type=str, help='要放的位置')
    parser_simple_put.add_argument('--filepath', type=str, help='文件路径', default=None)
    parser_simple_put.add_argument('--data', type=str, help='直接写字符串', default=None)
    parser_simple_put.set_defaults(func=simple_put)

    args = parser.parse_known_args()[0]
    args.func(args)


if __name__ == '__main__':
    main()
