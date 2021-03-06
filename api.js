import ngCookies from 'angular-cookies';

const apiModule = angular.module('yunityAPI', [
    ngCookies,
]);

apiModule.provider('PendingRequests', function() {

    let pendingRequests = {};

    let getRequestId = (config) => {
        return `${ config.method }:${ config.url }`;
    }

    let isPending = () => {
        return Object.keys(pendingRequests).length > 0;
    }

    return {
        $get () {
            return {
                isPending: isPending
            }
        },
        registerRequest (config) {
            let id = getRequestId(config);
            pendingRequests[id] = pendingRequests[id] ? pendingRequests[id] + 1 : 1;
        },
        registerResponse (response) {
            let id = getRequestId(response.config);
            pendingRequests[id] -= 1;
            if (pendingRequests[id] == 0) {
                delete pendingRequests[id];
            }
        },
        isPending: isPending,
    }
});

apiModule.config(($httpProvider, PendingRequestsProvider) => {

    let requestTracker = ($q) => {

        let pendingRequests = PendingRequestsProvider.pendingRequests;

        return {
            request: (config) => {
                PendingRequestsProvider.registerRequest(config);
                return config;
            },
            response: (response) => {
                PendingRequestsProvider.registerResponse(response);
                return response;
            },
            responseError: (rejection) => {
                // TODO: handle errors
                console.error('caught error: ', rejection);
                return $q.reject(rejection);
            }
        }
    }
    $httpProvider.interceptors.push(requestTracker);
})

apiModule.run(function ($http, $cookies) {
    var token = $cookies.get('csrftoken');
    if(token != undefined) {
        $http.defaults.headers.common['X-CSRFToken'] = token;
    }
});

apiModule.factory('yAPI', ['$http','$cookies','$rootScope' , '$q' ,function ($http, $cookies, $rootScope , $q) {



        return {
            url: '/api',
            urlSuffix: '',
            requestStart: function() {},
            requestComplete: function() {},
            requestFailed: function () {},
            users: [],
            session: {
                loggedin: false,
                user:{},
                chats:[]
            },

            /*
             * Configuration
             */
            config(opt) {

                if (opt.url !== undefined) {
                    this.url = opt.url;
                }

                if(opt.urlSuffix !== undefined) {
                    this.urlSuffix = opt.urlSuffix;
                }

                if(opt.requestStart !== undefined) {
                    this.requestStart = opt.requestStart;
                }

                if(opt.requestComplete !== undefined) {
                    this.requestComplete = opt.requestComplete;
                }

                if(opt.requestFailed !== undefined) {
                    this.requestFailed = opt.requestFailed;
                }

                //this.checkLogin();

            },

            getSession() {
                return this.session;
            },

            setSession(user) {

                this.session = {
                    loggedin:true,
                    user:user
                };
                $rootScope.session = this.session;
            },

            /*
             * To do: Method checks server side is the user still logged in
             */
            checkLogin: function() {

                let api = this;

                console.log('checklogin session is: ' , api.getSession());

                if(api.getSession().loggedin){
                        return $q.resolve();
                }
                return api.apiCall({
                    uri: '/auth/login',
                    method: 'GET'
                }).then(function(ret){

                    if(ret.data.user.id !== undefined) {

                        console.log('check login success user is logged in');

                        /*
                         * User is logged in set vars
                         */

                        api.setSession(ret.data.user);


                    } else {
                        console.log('user is not logged in');
                    }


                },function(){
                    console.log('check login failed');
                });

            },

            /*
             * list Mappable Items by Filter
             * Param Object => {filter}
             */
            listMappable(opt) {

                return this.apiCall('/items').then(
                    function(ret) {
                        console.log('listmappables success');
                        if(opt.success != undefined) {
                            opt.success(ret);
                        }
                    },
                    function(ret) {
                        console.log('listmappables error');
                        if(opt.error != undefined) {
                            opt.error(ret);
                        }
                    }
                );
            },

            /**
             * Auth API call
             * @param object => {email,password,[success],[error]}
             */
            authenticate(opt) {

                console.log(opt);

                let api = this;

                return this.apiCall({
                    uri: '/auth/login',
                    method: 'POST',
                    data: {
                        email: opt.email,
                        password: opt.password
                    },
                }).then(
                    function (ret) {
                        console.log('auth success');

                        /*
                         * maker USER Data accessable after login
                         */
                        /*
                         * User is logged in set vars
                         */
                        api.setSession(ret.data.user);

                        if(opt.success != undefined) {
                            opt.success(ret);
                        }
                    },
                    function (ret) {
                        console.log('auth error');
                        if(opt.error != undefined) {
                            opt.error(ret);
                        }
                    }
                );
            },

            getUsers(userIds) {
                let userIdsString = userIds.join(',');
                return this.apiCall('/user/' + userIdsString);
            },

            /*
             * Call the Api:
             * parameter Object { method, data, succes, error }
             *
             */
            apiCall(opt) {


                //console.log($http.defaults.headers.common); //['X-CSRFToken'] = $cookies.get('csrftoken');

                /*
                 * make this accessable
                 */
                let api = this;
                let urlBase = api.url;

                /*
                 * If opt is a string, use default values
                 */
                if (typeof(opt) === 'string') {
                    opt = {
                        uri: opt,
                        method: 'GET'
                    };
                }

                /*
                 * if no data and no method specified do GET othwist POST
                 */
                if (opt.method == undefined && opt.data == undefined) {
                    opt.method = 'GET';
                }
                else if (opt.method == undefined) {
                    opt.method = 'POST';
                }

                if (opt.uri != undefined) {
                    urlBase += opt.uri;
                }

                if (opt.data == undefined) {
                    opt.data = {};
                }

                api.requestStart();

                /*
                 * RUN Angulars HTTP Call
                 */
                return $http({
                    method: opt.method,
                    url: urlBase + api.urlSuffix,
                    data: opt.data
                }).then(function (data) {

                //     if(data.config.headers['X-CSRFToken'] != undefined) {
                //         console.log('set token');
                //         $http.defaults.headers.common['X-CSRFToken'] = data.config.headers['X-CSRFToken'];
                //}

                    api.requestComplete();

                    //console.log(data);
                    //set token everytime as default token
                    $http.defaults.headers.common['X-CSRFToken'] = $cookies.get('csrftoken');
                     //console.log('set token to: ' + $http.defaults.headers.common['X-CSRFToken']);

                    return data;
                });
            }
        };
}]);


//why is it called service when is factory?
apiModule.factory('MapItemService', ['$q', 'yAPI', function($q, yAPI) {
    return {
        getMapItemsAndUsers: function(opts) {
            return $q.all([
                yAPI.apiCall('/items'),
                yAPI.apiCall('/users'),
            ], function(items, users) {
                return {
                    items: items,
                    users: users
                }
            })
        },
        getMapItems: function(opts) {
            return yAPI.apiCall('/items');
        }
    };
}]);

apiModule.run(() => {

});

export default 'yunityAPI';
