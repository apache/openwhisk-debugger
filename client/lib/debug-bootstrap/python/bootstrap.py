#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

import base64
import httplib2
import json
import urllib


# returns a name escaped so it can be used in a url.
def getSafeName(name):
    safeChars = '@:./'
    return urllib.quote(name, safeChars)


def bootstrap(key, namespace, triggerName, main, actualParameters):
    try:
        result = main(actualParameters)

        http = httplib2.Http()

        url = 'https://openwhisk.ng.bluemix.net/api/v1/namespaces/%(namespace)s/triggers/%(name)s' % {
            'namespace': urllib.quote(namespace),
            'name': getSafeName(triggerName)
        }

        headers = {'Content-type': 'application/json' }

        auth = base64.encodestring(key).replace('\n', '')
        headers['Authorization'] = 'Basic %s' % auth

        payload = json.dumps(result)

        response, content = http.request(url, 'POST', headers=headers, body=payload)

    except:
        pass
