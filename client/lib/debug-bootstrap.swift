/*
 * Copyright 2015-2016 IBM Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import Foundation

/*var api = {
	host: "https://openwhisk.ng.bluemix.net",
	path: "/api/v1"
    };*/

func bootstrap(key: String, namespace: String, triggerName: String,
	       main: ([String:Any]) -> [String:Any],
	       actualParameters: [String:Any]) {
    
    let result = main(actualParameters);

    // print("Returning \(result)");

    do {
        // print("Firing trigger")
        try fireTrigger(loginString: key,
                        name: triggerName,
                        namespace: namespace,
                        parameters: result)
    } catch {
        print("Error finishing up the debug session: \(error)")
    }
}

/* Type of Whisk operation requested */
enum WhiskType {
    case action
    case trigger
}

 /* Base function to fire Whisk Trigger identified by components */
public func fireTrigger(loginString: String, name: String, package: String? = nil, namespace: String = "_", parameters: [String:Any]? = nil) throws {
    
    try whiskAPI(loginString: loginString, namespace: namespace, verb: "POST", type: .trigger, package: package, name:name, parameters: parameters, isSync: false)
}

/* Network call */
func whiskAPI(loginString: String, namespace: String, verb: String, type: WhiskType, package: String?, name: String, parameters: [String:Any]?, isSync: Bool) throws {
        
        // set authorization string
        let loginData: Data = loginString.data(using: String.Encoding.utf8)!
        let base64LoginString = loginData.base64EncodedString(options: NSData.Base64EncodingOptions(rawValue: 0))
        
        let typeStr: String!
        
        // set type
        switch type {
        case .action:
            typeStr = "actions"
        case .trigger:
            typeStr = "triggers"
        }
        
        // get base URL
        let actionURL = "https://openwhisk.ng.bluemix.net/api/v1/"

        var syncName = "namespaces/"
        
        var namespaceStr = namespace
        
        if namespace.characters.count == 0 {
            namespaceStr = "_"
        }
        
        if let package = package {
            if package.characters.count == 0 {
                syncName = syncName + namespaceStr+"/"+typeStr+"/"+name
            } else {
                syncName = syncName + namespaceStr+"/"+typeStr+"/"+package+"/"+name
            }
        } else {
            syncName = syncName + namespaceStr+"/"+typeStr+"/"+name
        }
        
        guard let encodedPath = syncName.addingPercentEncoding(withAllowedCharacters: CharacterSet.urlQueryAllowed) else {
            //callback(nil, WhiskError.httpError(description: "URL Encode error \(syncName)", statusCode: 400))
            return
        }
        
        syncName = encodedPath
        
        // create request
        guard let url = URL(string:actionURL+syncName) else {
            // send back error on main queue
            
            //callback(nil, WhiskError.httpError(description: "Malformed url \(actionURL+syncName)", statusCode: 400))
            
            return
            
        }

        // print("fire url \(url)")

        var request = URLRequest(url: url)
        request.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
        request.addValue("Basic \(base64LoginString)", forHTTPHeaderField: "Authorization")
        request.httpMethod = verb
        
        // create JSON from parameters dictionary
        do {
            
            if let parameters = parameters {
                request.httpBody = try JSONSerialization.data(withJSONObject: parameters, options: JSONSerialization.WritingOptions())
                // print("fire body \(request.httpBody)")
            }
            
        } catch {
            print("Error parsing JSON in Whisk request: \(error)")
        }
        
        let semaphore = DispatchSemaphore(value: 0)
       
        
        // retrieve session as default or use developer specified session
        let sess: URLSession!
        let sessConfig = URLSessionConfiguration.default
        sess = URLSession(configuration: sessConfig)
        
        // perform network request
        let task = sess.dataTask(with: request) {
            data, response, error in
            let statusCode: Int!

            if error != nil {
                
                if let httpResponse = response as? HTTPURLResponse {
                    statusCode = httpResponse.statusCode
                } else {
                    statusCode = -1
                }
                // return network transport error call on main queue
                /*DispatchQueue.main.async {
                    callback(nil, WhiskError.httpError(description: "\(error.localizedDescription)", statusCode: statusCode))
                }*/
                
                return
                
            } else { /* smurf */
                
                if let httpResponse = response as? HTTPURLResponse {
                    statusCode = httpResponse.statusCode
                    do {
                        // success
                        if statusCode < 300 {

                        } else {
                            /*DispatchQueue.main.async {
                                callback(nil, WhiskError.httpError(description: "Whisk returned HTTP error code", statusCode: statusCode))
                            }*/
                        }
                        
                    }}
                
            }

            semaphore.signal()
        }
        
        task.resume()
        _ = semaphore.wait(timeout: .distantFuture)
        
}
