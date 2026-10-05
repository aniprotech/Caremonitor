"""Prepare validated reference snapshots. Never changes patient or prescription records."""
import argparse, datetime, hashlib, json, pathlib, time, urllib.parse, urllib.request, zipfile
import xml.etree.ElementTree as ET

def fetch(url):
    req=urllib.request.Request(url,headers={'Accept':'application/json','User-Agent':'Caremonitor-reference-import/1.0'})
    with urllib.request.urlopen(req,timeout=45) as response:
        return json.load(response)

def hospitals(source):
    records=[]; offset=0; limit=100
    while True:
        if source=='ods-hospitals':
            base='https://directory.spineservices.nhs.uk/ORD/2-0-0/organisations'
            url=base+'?'+urllib.parse.urlencode({'Status':'Active','Roles':'RO198,RO149,RO176,RO150','Limit':limit,**({'Offset':offset} if offset else {}),'_format':'json'})
            page=fetch(url).get('Organisations')
            if not isinstance(page,list):raise ValueError('Invalid ODS response')
            records.extend({'code':str(r['OrgId']),'name':r['Name'],'postcode':r.get('PostCode'),'country':r.get('Country'),'kind':'hospital'} for r in page)
        else:
            base='https://www.opendata.nhs.scot/api/3/action/datastore_search'
            payload=fetch(base+'?'+urllib.parse.urlencode({'resource_id':'c698f450-eeed-41a0-88f7-c1e40a568acc','limit':limit,'offset':offset}))
            if payload.get('success') is not True:raise ValueError('Scotland service returned an error')
            page=payload['result']['records']
            records.extend({'code':str(r['HospitalCode']),'name':r['HospitalName'],'postcode':r.get('Postcode'),'country':'Scotland','kind':'hospital'} for r in page)
        if len(page)<limit:break
        offset+=limit
        if offset>=100000:raise ValueError('Pagination safety limit reached; snapshot not published')
        time.sleep(.3)
    return records,base

def dmd(path):
    records=[]
    with zipfile.ZipFile(path) as archive:
        members=[x for x in archive.infolist() if x.filename.lower().endswith('.xml') and any(pathlib.PurePosixPath(x.filename).name.lower().startswith('f_'+kind) for kind in ['vmp','amp']) and not any(pathlib.PurePosixPath(x.filename).name.lower().startswith('f_'+kind) for kind in ['vmpp','ampp'])]
        if not members:raise ValueError('No VMP/AMP XML files found; supply the licensed dm+d XML release ZIP')
        if sum(x.file_size for x in members)>1000000000:raise ValueError('Release exceeds 1 GB processing limit')
        for member in members:
            with archive.open(member) as stream:
                for event,element in ET.iterparse(stream,events=('end',)):
                    tag=element.tag.rsplit('}',1)[-1]
                    if tag not in ['VMP','AMP']:continue
                    values={child.tag.rsplit('}',1)[-1]:child.text for child in element}
                    code=values.get('VPID' if tag=='VMP' else 'APID');name=values.get('NM')
                    if code and name and values.get('INVALID','0') not in ['1','true']:
                        records.append({'code':code,'name':name,'kind':'medicine','conceptType':tag,'country':'United Kingdom'})
                    element.clear()
    return records,'https://isd.digital.nhs.uk/trud/'

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',choices=['ods-hospitals','scotland-hospitals','dmd'])
    parser.add_argument('--input',help='Licensed dm+d XML release ZIP, obtained through your TRUD subscription')
    parser.add_argument('--release',required=True,help='Actual source release/version identifier')
    parser.add_argument('--output',required=True)
    args=parser.parse_args()
    if args.source=='dmd' and not args.input:parser.error('--input is required for dm+d')
    records,url=dmd(args.input) if args.source=='dmd' else hospitals(args.source)
    if not records or len({r['code'] for r in records})!=len(records):raise ValueError('Empty or duplicate-code snapshot; nothing published')
    snapshot={'source':args.source,'release':args.release,'sourceUrl':url,'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'records':records}
    if args.input:snapshot['inputSha256']=hashlib.sha256(pathlib.Path(args.input).read_bytes()).hexdigest()
    output=pathlib.Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
    temp=output.with_suffix(output.suffix+'.tmp');temp.write_text(json.dumps(snapshot,ensure_ascii=False,indent=2));temp.replace(output)
    print(json.dumps({'source':args.source,'records':len(records),'output':str(output)}))
if __name__=='__main__':main()
